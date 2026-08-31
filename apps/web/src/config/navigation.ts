import {
  Bell,
  BookOpen,
  Boxes,
  ChartColumn,
  Headphones,
  History,
  LayoutDashboard,
  type LucideIcon,
  MessageSquare,
  Settings,
  Sparkles,
  Tag,
  Ticket,
  Users,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Descripcion corta usada en las paginas de modulo aun sin implementar. */
  description: string;
}

export interface NavSection {
  /** Titulo del grupo en la barra lateral. `null` en el grupo principal. */
  title: string | null;
  items: NavItem[];
}

/**
 * Estructura de navegacion del panel administrativo.
 *
 * Los modulos estan agrupados por proposito en lugar de listados en plano:
 * con trece entradas, la agrupacion es lo que mantiene la barra legible.
 * Cada entrada ya tiene ruta; su contenido llega en fases posteriores.
 */
export const navigation: NavSection[] = [
  {
    title: null,
    items: [
      {
        label: 'Dashboard',
        href: '/admin',
        icon: LayoutDashboard,
        description: 'Vision general de la actividad de soporte.',
      },
    ],
  },
  {
    title: 'Operacion',
    items: [
      {
        label: 'Tickets',
        href: '/admin/tickets',
        icon: Ticket,
        description: 'Registro, seguimiento y resolucion de incidencias.',
      },
      {
        label: 'Conversaciones',
        href: '/admin/conversaciones',
        icon: MessageSquare,
        description: 'Mensajeria con los clientes sobre cada incidencia.',
      },
      {
        label: 'Clientes',
        href: '/admin/clientes',
        icon: Users,
        description: 'Empresas y contactos con acceso al portal de soporte.',
      },
      {
        label: 'Proyectos y servicios',
        href: '/admin/servicios',
        icon: Boxes,
        description:
          'Webs, sistemas, aulas virtuales, hosting, dominios, correos y bases de datos.',
      },
      {
        label: 'Categorias',
        href: '/admin/categorias',
        icon: Tag,
        description: 'Clasificacion de incidencias por tipo de servicio.',
      },
    ],
  },
  {
    title: 'Automatizacion',
    items: [
      {
        label: 'Encargado de soporte',
        href: '/admin/soporte',
        icon: Headphones,
        description: 'Asignacion y carga de trabajo del equipo de soporte.',
      },
      {
        label: 'IA de soporte',
        href: '/admin/ia',
        icon: Sparkles,
        description: 'Respuestas asistidas y clasificacion automatica de tickets.',
      },
      {
        label: 'Base de conocimiento',
        href: '/admin/base-conocimiento',
        icon: BookOpen,
        description: 'Articulos y soluciones reutilizables para incidencias frecuentes.',
      },
    ],
  },
  {
    title: 'Analisis',
    items: [
      {
        label: 'Reportes',
        href: '/admin/reportes',
        icon: ChartColumn,
        description: 'Indicadores de volumen, tiempos de respuesta y resolucion.',
      },
      {
        label: 'Historial',
        href: '/admin/historial',
        icon: History,
        description: 'Trazabilidad de cambios y acciones sobre cada registro.',
      },
    ],
  },
  {
    title: 'Sistema',
    items: [
      {
        label: 'Notificaciones',
        href: '/admin/notificaciones',
        icon: Bell,
        description: 'Avisos por correo y en la aplicacion.',
      },
      {
        label: 'Configuracion',
        href: '/admin/configuracion',
        icon: Settings,
        description: 'Preferencias generales del sistema y de la cuenta.',
      },
    ],
  },
];

/** Todas las entradas en plano, util para resolver rutas y migas de pan. */
export const navItems: NavItem[] = navigation.flatMap((section) => section.items);

/**
 * Entrada de navegacion correspondiente a una ruta.
 * Devuelve la coincidencia mas especifica (`/admin/tickets` antes que `/admin`).
 */
export function findNavItem(pathname: string): NavItem | undefined {
  return [...navItems]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}
