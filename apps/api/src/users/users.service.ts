import type { PublicUser, UserRef } from '@conit/types';
import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import type { User } from '../generated/prisma/client';
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
  constructor(private readonly prisma: PrismaService) {}

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
}
