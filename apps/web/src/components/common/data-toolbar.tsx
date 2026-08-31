'use client';

import { Button, cn, Input } from '@conit/ui';
import { SearchIcon, XIcon } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';

interface DataToolbarProps {
  /** Valor confirmado de la busqueda (el que ya viaja a la API). */
  search: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
  /** Selectores de filtro adicionales. */
  children?: ReactNode;
  /** Se muestra cuando hay algun filtro distinto del valor por defecto. */
  onReset?: () => void;
  className?: string;
}

/** Retardo antes de lanzar la busqueda mientras se escribe. */
const DEBOUNCE_MS = 350;

/**
 * Barra de filtros de un listado.
 *
 * La busqueda se aplica con retardo: sin el, cada pulsacion dispararia una
 * peticion y la tabla parpadearia constantemente. El campo mantiene su propio
 * estado local para que escribir siga siendo fluido aunque la consulta tarde.
 */
export function DataToolbar({
  search,
  onSearchChange,
  placeholder = 'Buscar…',
  children,
  onReset,
  className,
}: DataToolbarProps) {
  const [value, setValue] = useState(search);

  // Sincroniza si el valor cambia desde fuera (por ejemplo, al limpiar filtros).
  const [lastExternal, setLastExternal] = useState(search);

  if (search !== lastExternal) {
    setLastExternal(search);
    setValue(search);
  }

  useEffect(() => {
    if (value === search) return;

    const timer = setTimeout(() => onSearchChange(value), DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [value, search, onSearchChange]);

  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center', className)}>
      <div className="relative w-full sm:max-w-xs">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="pl-9"
        />
      </div>

      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}

      {onReset ? (
        <Button variant="ghost" size="sm" onClick={onReset} className="sm:ml-auto">
          <XIcon />
          Limpiar filtros
        </Button>
      ) : null}
    </div>
  );
}
