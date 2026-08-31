'use client';

import { Button, Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@conit/ui';
import { MenuIcon } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { SidebarContent } from './sidebar';

/**
 * Navegacion movil.
 *
 * Reutiliza exactamente el mismo contenido que la barra lateral de escritorio
 * dentro de un panel deslizante, que aporta foco atrapado, cierre con
 * `Escape` y bloqueo del scroll de fondo.
 */
export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);

  // Ajuste de estado durante el render (patron recomendado por React frente a
  // un `useEffect`, que provocaria un render en cascada): si la ruta cambia
  // con el panel abierto —por ejemplo con el boton "atras"— se cierra.
  if (pathname !== lastPathname) {
    setLastPathname(pathname);

    if (open) {
      setOpen(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Abrir menu">
          <MenuIcon />
        </Button>
      </SheetTrigger>

      <SheetContent side="left" className="p-0">
        {/* Titulo y descripcion accesibles, requeridos por el dialogo. */}
        <SheetTitle className="sr-only">Menu de navegacion</SheetTitle>
        <SheetDescription className="sr-only">
          Secciones del panel administrativo de CONIT Support.
        </SheetDescription>

        <SidebarContent onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
