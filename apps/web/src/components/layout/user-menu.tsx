'use client';

import { type PublicUser, USER_ROLES } from '@conit/types';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  getInitials,
  Skeleton,
} from '@conit/ui';
import { LogOutIcon, SettingsIcon, UserIcon } from 'lucide-react';
import Link from 'next/link';

import { useLogout } from '@/hooks/use-logout';

const ROLE_LABEL: Record<string, string> = {
  [USER_ROLES.ADMIN]: 'Administrador',
  [USER_ROLES.CLIENT]: 'Cliente',
};

interface UserMenuProps {
  user: PublicUser | undefined;
}

/** Marcador mientras se resuelve la sesion, sin desplazar el layout. */
function UserMenuSkeleton() {
  return (
    <div className="flex items-center gap-2.5 pl-1">
      <Skeleton shape="circle" className="size-8" />
      <div className="hidden flex-col gap-1.5 sm:flex">
        <Skeleton shape="text" className="h-2.5 w-24" />
        <Skeleton shape="text" className="h-2 w-16" />
      </div>
    </div>
  );
}

/** Identidad del usuario y acciones de cuenta. */
export function UserMenu({ user }: UserMenuProps) {
  const logout = useLogout();

  if (!user) {
    return <UserMenuSkeleton />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2.5 rounded-md py-1 pr-1 pl-1 transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/22 sm:pr-2.5"
        aria-label={`Cuenta de ${user.name}`}
      >
        <Avatar>
          {user.avatar ? <AvatarImage src={user.avatar} alt="" /> : null}
          <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
        </Avatar>

        <span className="hidden min-w-0 flex-col items-start leading-tight sm:flex">
          <span className="max-w-[10rem] truncate text-sm font-medium">{user.name}</span>
          <span className="text-xs text-muted-foreground">
            {ROLE_LABEL[user.role] ?? user.role}
          </span>
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-64">
        <div className="flex flex-col gap-1 px-2 py-2">
          <span className="truncate text-sm font-medium">{user.name}</span>
          <span className="truncate text-xs text-muted-foreground">{user.email}</span>
          <Badge variant="default" className="mt-1.5 w-fit">
            {ROLE_LABEL[user.role] ?? user.role}
          </Badge>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/admin/configuracion">
              <UserIcon />
              Mi perfil
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/admin/configuracion">
              <SettingsIcon />
              Configuracion
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          variant="destructive"
          disabled={logout.isPending}
          onSelect={(event) => {
            // Se evita el cierre inmediato para que el estado de carga sea visible.
            event.preventDefault();
            logout.mutate();
          }}
        >
          <LogOutIcon />
          {logout.isPending ? 'Cerrando sesion…' : 'Cerrar sesion'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
