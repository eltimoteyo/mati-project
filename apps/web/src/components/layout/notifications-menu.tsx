'use client';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@conit/ui';
import { BellIcon, BellOffIcon } from 'lucide-react';
import Link from 'next/link';

/**
 * Menu de notificaciones.
 *
 * En la Fase 1 no existe origen de datos de notificaciones, por lo que se
 * muestra el estado vacio real en lugar de avisos simulados: el panel nunca
 * debe presentar informacion que no provenga del backend.
 */
export function NotificationsMenu() {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Notificaciones">
              <BellIcon />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Notificaciones</TooltipContent>
      </Tooltip>

      <DropdownMenuContent className="w-80 p-0">
        <div className="px-3 py-2.5">
          <DropdownMenuLabel className="px-0 py-0 text-sm font-semibold text-foreground">
            Notificaciones
          </DropdownMenuLabel>
        </div>

        <DropdownMenuSeparator className="mx-0 my-0" />

        <EmptyState
          icon={BellOffIcon}
          title="No tienes notificaciones"
          description="Aqui apareceran los avisos sobre tus tickets y conversaciones."
          className="px-5 py-10"
        />

        <DropdownMenuSeparator className="mx-0 my-0" />

        <div className="p-1">
          <Button asChild variant="ghost" size="sm" block className="justify-center">
            <Link href="/admin/notificaciones">Ver configuracion de avisos</Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
