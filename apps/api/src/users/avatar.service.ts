import { randomBytes } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../config/configuration';
import { PrismaService } from '../database/prisma.service';

/** Tamano maximo del avatar. Un retrato razonable no pasa de aqui. */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/**
 * Formatos admitidos, con su firma de bytes.
 *
 * La comprobacion se hace sobre el contenido y no sobre el `mimetype` que
 * declara la peticion: ese campo lo escribe quien sube el fichero, asi que un
 * ejecutable renombrado a `.png` lo pasaria sin mas. Los primeros bytes, en
 * cambio, no se pueden falsear sin dejar de ser una imagen valida.
 */
const SIGNATURES: Array<{ extension: string; mime: string; matches: (buffer: Buffer) => boolean }> =
  [
    {
      extension: 'png',
      mime: 'image/png',
      matches: (b) =>
        b.length > 8 &&
        b[0] === 0x89 &&
        b[1] === 0x50 &&
        b[2] === 0x4e &&
        b[3] === 0x47 &&
        b[4] === 0x0d &&
        b[5] === 0x0a &&
        b[6] === 0x1a &&
        b[7] === 0x0a,
    },
    {
      extension: 'jpg',
      mime: 'image/jpeg',
      matches: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
    },
    {
      extension: 'webp',
      mime: 'image/webp',
      // "RIFF" .... "WEBP"
      matches: (b) =>
        b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
    },
  ];

/** Prefijo publico bajo el que se sirven los avatares. */
export const AVATAR_URL_PREFIX = '/uploads/avatars';

/**
 * Fichero recibido, con lo unico que este servicio necesita.
 *
 * Se declara aqui en lugar de usar `Express.Multer.File`: ese tipo llega por
 * augmentacion del espacio de nombres global de Express 4, que no resuelve de
 * forma fiable con la version instalada. Nombrar los dos campos que se usan
 * deja explicito el contrato y no depende de tipos ambientales.
 */
export interface UploadedImage {
  buffer: Buffer;
  size: number;
}

/**
 * Foto de perfil de un usuario.
 *
 * El fichero se guarda en disco y en la base solo queda su ruta publica. No se
 * almacena en la propia tabla porque una imagen en base64 dentro de una columna
 * se arrastra en cada consulta de usuario, incluidas las del listado.
 *
 * El nombre del fichero lo genera el servidor a partir de bytes aleatorios: el
 * que envia el navegador es texto controlado por quien sube, y usarlo abriria
 * la puerta a escribir fuera del directorio previsto.
 */
@Injectable()
export class AvatarService {
  private readonly logger = new Logger(AvatarService.name);
  private readonly uploadsDir: string;

  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService<AppConfig, true>,
  ) {
    this.uploadsDir = configService.get('uploads', { infer: true }).dir;
  }

  /** Guarda la imagen y devuelve la URL publica resultante. */
  async replace(userId: string, file: UploadedImage): Promise<string> {
    const format = this.detectFormat(file.buffer);

    if (!format) {
      throw new BadRequestException(
        'El fichero no es una imagen valida. Se admiten PNG, JPG y WEBP.',
      );
    }

    if (file.size > MAX_AVATAR_BYTES) {
      throw new BadRequestException('La imagen no puede superar los 2 MB.');
    }

    const directory = join(this.uploadsDir, 'avatars');
    await mkdir(directory, { recursive: true });

    const filename = `${userId}-${randomBytes(8).toString('hex')}.${format.extension}`;
    await writeFile(join(directory, filename), file.buffer);

    const previous = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { avatar: `${AVATAR_URL_PREFIX}/${filename}` },
    });

    // La anterior se borra despues de guardar la nueva: si se hiciera antes y
    // fallara la escritura, el usuario se quedaria sin ninguna.
    await this.deleteFile(previous?.avatar ?? null);

    return `${AVATAR_URL_PREFIX}/${filename}`;
  }

  /** Retira la foto actual. */
  async remove(userId: string): Promise<void> {
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true },
    });

    await this.prisma.user.update({ where: { id: userId }, data: { avatar: null } });
    await this.deleteFile(current?.avatar ?? null);
  }

  private detectFormat(buffer: Buffer | undefined) {
    if (!buffer || buffer.length === 0) return null;

    return SIGNATURES.find((signature) => signature.matches(buffer)) ?? null;
  }

  /**
   * Borra un avatar antiguo del disco.
   *
   * Solo actua sobre rutas que el propio sistema genero, y se queda con el
   * nombre base: asi una ruta manipulada en la base de datos no puede llevar
   * el borrado a otro directorio.
   *
   * Un fallo al borrar no interrumpe nada: el fichero huerfano ocupa unos
   * kilobytes y el usuario ya tiene su avatar nuevo.
   */
  private async deleteFile(publicPath: string | null): Promise<void> {
    if (!publicPath?.startsWith(`${AVATAR_URL_PREFIX}/`)) return;

    try {
      await unlink(join(this.uploadsDir, 'avatars', basename(publicPath)));
    } catch (error) {
      this.logger.warn(
        `No se pudo borrar el avatar anterior: ${
          error instanceof Error ? error.message : 'error desconocido'
        }`,
      );
    }
  }
}
