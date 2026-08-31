import { PageLoader } from '@conit/ui';

/** Estado de carga a nivel de aplicacion durante la navegacion inicial. */
export default function Loading() {
  return <PageLoader fullscreen message="Cargando CONIT Support…" />;
}
