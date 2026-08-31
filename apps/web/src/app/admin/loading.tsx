import { CardGridSkeleton, Skeleton } from '@conit/ui';

/**
 * Estado de carga entre secciones del panel.
 * Reproduce la estructura habitual (encabezado + rejilla) para que el
 * contenido definitivo no provoque desplazamiento del layout.
 */
export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-52" />
        <Skeleton shape="text" className="w-80" />
      </div>

      <CardGridSkeleton />

      <Skeleton className="h-72 w-full rounded-lg" />
    </div>
  );
}
