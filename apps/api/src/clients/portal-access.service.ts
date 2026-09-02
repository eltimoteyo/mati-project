import { randomInt } from 'node:crypto';

import { USER_ROLES, USER_STATUSES } from '@conit/types';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { PasswordService } from '../auth/services/password.service';
import { SessionService } from '../auth/services/session.service';
import { PrismaService } from '../database/prisma.service';
import { CredentialsMailService } from '../mail/credentials-mail.service';

/**
 * Alfabeto de las contrasenas generadas.
 *
 * Sin `l`, `I`, `1`, `O` ni `0`: la contrasena se lee de un correo y a menudo
 * se teclea a mano, y esos caracteres se confunden entre si.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

/** Longitud de la contrasena generada al restablecer. */
const GENERATED_LENGTH = 14;

/** Lo que se devuelve al consultar o conceder el acceso. */
export interface PortalAccess {
  enabled: boolean;
  user: { id: string; name: string; email: string; status: string; lastLoginAt: string | null } | null;
  /**
   * Resultado del envio de credenciales, cuando se pidio.
   *
   * `null` si no se pidio enviarlas. Si el envio falla, el acceso queda
   * concedido igualmente: la cuenta funciona aunque el correo no salga, y
   * deshacerlo dejaria al cliente sin acceso por un problema del proveedor.
   */
  email: { sent: boolean; reason?: string } | null;
}

/**
 * Acceso de un cliente a su portal.
 *
 * Un cliente es una ficha comercial; para entrar al portal necesita ademas una
 * cuenta de usuario con rol CLIENT vinculada a esa ficha. Esta clase es la
 * unica que crea ese vinculo, de modo que no puede quedar un usuario CLIENT
 * suelto sin cliente (no podria operar) ni dos fichas apuntando al mismo
 * usuario (la relacion es unica en la base de datos).
 *
 * La contrasena inicial la fija quien concede el acceso, y opcionalmente se le
 * envia al cliente por correo. Ese correo transporta la contrasena en claro,
 * asi que pide expresamente cambiarla al entrar y borrar el mensaje: es el
 * compromiso habitual entre poder entregar el acceso y no dejarlo circulando.
 *
 * No existe un "reenviar la contrasena": solo se guarda su hash. Volver a
 * comunicarla exige generar una nueva, que es lo que hace `resetAndSend`.
 */
@Injectable()
export class PortalAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly sessionService: SessionService,
    private readonly credentialsMail: CredentialsMailService,
  ) {}

  async get(clientId: string): Promise<PortalAccess> {
    const client = await this.load(clientId);

    if (!client.user) return { enabled: false, user: null, email: null };

    return {
      enabled: client.user.status === USER_STATUSES.ACTIVE,
      user: {
        id: client.user.id,
        name: client.user.name,
        email: client.user.email,
        status: client.user.status,
        lastLoginAt: client.user.lastLoginAt?.toISOString() ?? null,
      },
      email: null,
    };
  }

  /**
   * Concede el acceso.
   *
   * Si ya existe un usuario vinculado, reactiva la cuenta y actualiza la
   * contrasena. Si no, crea la cuenta con el correo de la ficha.
   */
  async grant(
    clientId: string,
    password: string,
    options: { name?: string; sendEmail?: boolean } = {},
  ): Promise<PortalAccess> {
    const client = await this.load(clientId);
    const { name, sendEmail = false } = options;

    if (client.status !== 'ACTIVE') {
      throw new BadRequestException('No se puede dar acceso a un cliente inactivo');
    }

    const passwordHash = await this.passwordService.hash(password);

    if (client.user) {
      await this.prisma.user.update({
        where: { id: client.user.id },
        data: {
          passwordHash,
          status: USER_STATUSES.ACTIVE,
          ...(name ? { name } : {}),
        },
      });

      // Cambiar la contrasena invalida lo anterior: las sesiones abiertas con
      // la clave antigua no deben sobrevivir.
      await this.sessionService.revokeAllForUser(client.user.id);

      return this.withEmail(clientId, password, sendEmail, true);
    }

    const email = client.email.trim().toLowerCase();

    const taken = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });

    if (taken) {
      throw new ConflictException(
        'Ya existe un usuario con el correo de este cliente. Vinculalo o cambia el correo de la ficha.',
      );
    }

    await this.prisma.user.create({
      data: {
        name: name ?? client.contactName ?? client.name,
        email,
        passwordHash,
        role: USER_ROLES.CLIENT,
        status: USER_STATUSES.ACTIVE,
        // La relacion vive en `Client`: se enlaza desde el mismo lado que la
        // declara, para que no pueda quedar a medias.
        clientProfile: { connect: { id: clientId } },
      },
    });

    return this.withEmail(clientId, password, sendEmail, false);
  }

  /**
   * Genera una contrasena nueva y la envia por correo.
   *
   * No existe un "reenviar la contrasena actual": en la base de datos solo hay
   * un hash, del que no se puede recuperar el original. Restablecerla es la
   * unica forma honesta de volver a comunicarla.
   */
  async resetAndSend(clientId: string): Promise<PortalAccess> {
    const client = await this.load(clientId);

    if (!client.user) {
      throw new NotFoundException('Este cliente no tiene acceso al portal');
    }

    return this.grant(clientId, PortalAccessService.generatePassword(), { sendEmail: true });
  }

  /**
   * Contrasena aleatoria.
   *
   * Usa `randomInt` del modulo de criptografia, no `Math.random`: este ultimo
   * es predecible y no sirve para nada que proteja una cuenta.
   */
  static generatePassword(): string {
    let password = '';

    for (let index = 0; index < GENERATED_LENGTH; index += 1) {
      password += ALPHABET[randomInt(ALPHABET.length)];
    }

    return password;
  }

  /**
   * Retira el acceso.
   *
   * Desactiva la cuenta y revoca sus sesiones, pero no la borra: sus mensajes
   * en los tickets siguen siendo suyos, y eliminarla los dejaria sin autor.
   */
  async revoke(clientId: string): Promise<PortalAccess> {
    const client = await this.load(clientId);

    if (!client.user) {
      throw new NotFoundException('Este cliente no tiene acceso al portal');
    }

    await this.prisma.user.update({
      where: { id: client.user.id },
      data: { status: USER_STATUSES.INACTIVE },
    });

    await this.sessionService.revokeAllForUser(client.user.id);

    return this.get(clientId);
  }

  /**
   * Envia las credenciales si se pidio, y devuelve el estado resultante.
   *
   * El envio va despues de escribir en la base de datos: si fallase antes, el
   * cliente recibiria una contrasena que no llego a aplicarse.
   */
  private async withEmail(
    clientId: string,
    password: string,
    sendEmail: boolean,
    isReset: boolean,
  ): Promise<PortalAccess> {
    const access = await this.get(clientId);

    if (!sendEmail || !access.user) return access;

    const client = await this.load(clientId);

    const result = await this.credentialsMail.send({
      recipientName: access.user.name,
      clientName: client.name,
      email: access.user.email,
      password,
      isReset,
    });

    return {
      ...access,
      email: { sent: result.sent, ...(result.reason ? { reason: result.reason } : {}) },
    };
  }

  private async load(clientId: string) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        name: true,
        email: true,
        contactName: true,
        status: true,
        user: {
          select: { id: true, name: true, email: true, status: true, lastLoginAt: true },
        },
      },
    });

    if (!client) {
      throw new NotFoundException('El cliente no existe');
    }

    return client;
  }
}
