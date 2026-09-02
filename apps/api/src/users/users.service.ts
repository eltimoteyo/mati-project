import {
  type PaginatedData,
  type PublicUser,
  USER_STATUSES,
  type UserRef,
} from '@conit/types';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { PasswordService } from '../auth/services/password.service';
import { SessionService } from '../auth/services/session.service';
import { paginate, type PaginationQueryDto, searchFilter, toSkipTake } from '../common/dto/pagination.dto';
import { PrismaService } from '../database/prisma.service';
import type { Prisma, User } from '../generated/prisma/client';
import type { CreateUserDto, UpdateUserDto, UserQueryDto } from './dto/manage-user.dto';
import { toPublicUser } from './users.mapper';

/**
 * Acceso al dominio de usuarios.
 *
 * Toda la logica de lectura y actualizacion vive aqui; los controladores
 * solo traducen HTTP. `AuthService` reutiliza este servicio en lugar de
 * consultar Prisma por su cuenta.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly sessionService: SessionService,
  ) {}

  /** Normaliza el correo del mismo modo que el seed y el registro. */
  static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  /** Busca por correo incluyendo el hash: uso exclusivo del flujo de login. */
  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: UsersService.normalizeEmail(email) },
    });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /** Perfil publico del usuario. Lanza 404 si no existe. */
  async getProfile(id: string): Promise<PublicUser> {
    const user = await this.findById(id);

    if (!user) {
      throw new NotFoundException('El usuario no existe');
    }

    return toPublicUser(user);
  }

  /**
   * Administradores activos, para el selector de responsable de un ticket.
   * En esta fase el equipo de soporte son los usuarios con rol ADMIN.
   */
  async findAssignableOptions(): Promise<UserRef[]> {
    const users = await this.prisma.user.findMany({
      where: { role: 'ADMIN', status: 'ACTIVE' },
      select: { id: true, name: true, email: true, avatar: true },
      orderBy: { name: 'asc' },
    });

    return users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
    }));
  }

  /** Actualiza los datos que el propio usuario puede editar. */
  async updateProfile(id: string, name: string): Promise<PublicUser> {
    await this.getProfile(id);

    const user = await this.prisma.user.update({ where: { id }, data: { name } });

    return toPublicUser(user);
  }

  /** Sustituye el hash de la contrasena. Solo lo usa `AuthService`. */
  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
  }

  /** Registra la marca temporal del ultimo inicio de sesion correcto. */
  async registerLogin(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  /* ---------------------------------------------------------------------------
   * Gestion del equipo
   * ------------------------------------------------------------------------ */

  async findAll(query: UserQueryDto): Promise<PaginatedData<PublicUser>> {
    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...searchFilter(query.search, ['name', 'email']),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { [query.sortBy]: query.sortOrder },
        ...toSkipTake(query as PaginationQueryDto),
      }),
      this.prisma.user.count({ where }),
    ]);

    return paginate(items.map(toPublicUser), total, query as PaginationQueryDto);
  }

  /**
   * Alta de un miembro del equipo.
   *
   * La contrasena inicial la fija quien crea la cuenta y llega ya validada por
   * el DTO. No se devuelve en ningun momento: se comunica por el canal que el
   * administrador considere, y el titular la cambia desde Configuracion.
   */
  async create(dto: CreateUserDto): Promise<PublicUser> {
    const email = UsersService.normalizeEmail(dto.email);

    const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });

    if (existing) {
      throw new ConflictException('Ya existe un usuario con ese correo');
    }

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email,
        passwordHash: await this.passwordService.hash(dto.password),
        role: dto.role,
        ...(dto.status ? { status: dto.status } : {}),
      },
    });

    return toPublicUser(user);
  }

  /**
   * Edicion de un miembro del equipo.
   *
   * Desactivar a alguien revoca sus sesiones en el acto: si solo se marcase la
   * cuenta como inactiva, el token de acceso que ya tuviera en el navegador
   * seguiria siendo valido hasta caducar.
   */
  async update(id: string, dto: UpdateUserDto, actorId: string): Promise<PublicUser> {
    const current = await this.findById(id);

    if (!current) {
      throw new NotFoundException('El usuario no existe');
    }

    this.assertNotSelfLockout(current, dto, actorId);

    if (dto.status === USER_STATUSES.INACTIVE || dto.role === 'CLIENT') {
      await this.assertNotLastAdmin(id);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });

    const lostAccess =
      (dto.status !== undefined && dto.status !== current.status && dto.status === USER_STATUSES.INACTIVE) ||
      (dto.role !== undefined && dto.role !== current.role);

    if (lostAccess) {
      await this.sessionService.revokeAllForUser(id);
    }

    return toPublicUser(user);
  }

  /**
   * Fija una contrasena nueva y cierra las sesiones del titular.
   *
   * Es la via para recuperar una cuenta cuyo titular perdio el acceso. Revocar
   * las sesiones es parte de la operacion: si la cuenta pudo estar
   * comprometida, dejar viva una sesion abierta no arregla nada.
   */
  async resetPassword(id: string, password: string): Promise<void> {
    const user = await this.findById(id);

    if (!user) {
      throw new NotFoundException('El usuario no existe');
    }

    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: await this.passwordService.hash(password) },
    });

    await this.sessionService.revokeAllForUser(id);
  }

  /**
   * Nadie puede desactivarse ni degradarse a si mismo.
   *
   * Sin esta comprobacion, un descuido en la propia ficha dejaria al
   * administrador fuera del panel en el que estaba trabajando.
   */
  private assertNotSelfLockout(current: User, dto: UpdateUserDto, actorId: string): void {
    if (current.id !== actorId) return;

    if (dto.status !== undefined && dto.status !== current.status) {
      throw new BadRequestException('No puedes cambiar el estado de tu propia cuenta');
    }

    if (dto.role !== undefined && dto.role !== current.role) {
      throw new BadRequestException('No puedes cambiar tu propio rol');
    }
  }

  /** El sistema debe conservar al menos un administrador activo. */
  private async assertNotLastAdmin(id: string): Promise<void> {
    const remaining = await this.prisma.user.count({
      where: { role: 'ADMIN', status: USER_STATUSES.ACTIVE, id: { not: id } },
    });

    if (remaining === 0) {
      throw new ConflictException(
        'Es el ultimo administrador activo. Da de alta a otro antes de retirarle el acceso.',
      );
    }
  }
}
