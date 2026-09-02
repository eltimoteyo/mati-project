'use client';

import { USER_ROLES } from '@conit/types';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  getInitials,
  Skeleton,
} from '@conit/ui';
import { ArrowRightIcon, LayoutDashboardIcon, LogOutIcon, TicketIcon, UserIcon } from 'lucide-react';
import Link from 'next/link';

import { useLogout } from '@/hooks/use-logout';
import { useSession } from '@/hooks/use-session';
import { resolveAvatarUrl } from '@/lib/env';

/**
 * Acceso desde el sitio publico.
 *
 * Si no hay sesion muestra el boton de entrar. Si la hay, muestra a la persona
 * con su foto y la lleva a su area: el panel si es del equipo, el portal si es
 * cliente. Antes, quien ya habia entrado volvia a ver "Area de soporte" y
 * acababa en el formulario de acceso otra vez.
 */
export function SiteUserMenu() {
  const { user, isLoading, isAuthenticated } = useSession();
  const logout = useLogout();

  if (isLoading) {
    return <Skeleton className="h-9 w-32 rounded-md" />;
  }

  if (!isAuthenticated || !user) {
    return (
      <Button
        asChild
        size="sm"
        className="group bg-[#024A9D] text-white shadow-[0_8px_24px_-12px_rgba(2,74,157,0.8)] hover:bg-[#02224a]"
      >
        <Link href="/login">
          Area de soporte
          <ArrowRightIcon className="transition-transform duration-300 group-hover:translate-x-0.5" />
        </Link>
      </Button>
    );
  }

  const isClient = user.role === USER_ROLES.CLIENT;
  const areaHref = isClient ? '/portal' : '/admin';
  const areaLabel = isClient ? 'Mi portal' : 'Panel de administracion';
  const AreaIcon = isClient ? TicketIcon : LayoutDashboardIcon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pr-3 pl-1 transition-colors hover:border-[#024A9D]/30 focus-visible:ring-[3px] focus-visible:ring-[#024A9D]/25 focus-visible:outline-none"
          aria-label={`Cuenta de ${user.name}`}
        >
          <Avatar className="size-7">
            {user.avatar ? <AvatarImage src={resolveAvatarUrl(user.avatar)} alt="" /> : null}
            <AvatarFallback className="text-[0.65rem]">{getInitials(user.name)}</AvatarFallback>
          </Avatar>
          <span className="max-w-[9rem] truncate text-sm font-medium text-[#02224a]">
            {user.name.split(' ')[0]}
          </span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate font-medium">{user.name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href={areaHref}>
            <AreaIcon />
            {areaLabel}
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link href={isClient ? '/portal/perfil' : '/admin/configuracion'}>
            <UserIcon />
            Mi perfil
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          variant="destructive"
          disabled={logout.isPending}
          onSelect={() => logout.mutate()}
        >
          <LogOutIcon />
          Cerrar sesion
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
