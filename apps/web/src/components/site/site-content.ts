import {
  BookOpenIcon,
  ClockIcon,
  DatabaseIcon,
  GaugeCircleIcon,
  GlobeIcon,
  GraduationCapIcon,
  LayoutTemplateIcon,
  LifeBuoyIcon,
  type LucideIcon,
  MailIcon,
  MonitorSmartphoneIcon,
  RouteIcon,
  ServerIcon,
  ShieldCheckIcon,
  TicketIcon,
  UsersIcon,
} from 'lucide-react';

/**
 * Contenido del sitio publico.
 *
 * Vive aparte de los componentes para que las paginas compartan exactamente
 * los mismos textos: el catalogo de servicios aparece en la portada y en su
 * propia pagina, y tener dos copias garantiza que acaben divergiendo.
 */

export interface ServiceEntry {
  slug: string;
  icon: LucideIcon;
  title: string;
  summary: string;
  /** Lo que incluye el servicio, en la pagina de detalle. */
  includes: string[];
}

export const SERVICES: ServiceEntry[] = [
  {
    slug: 'paginas-web',
    icon: LayoutTemplateIcon,
    title: 'Paginas web',
    summary:
      'Sitios corporativos disenados y desarrollados a medida, rapidos y preparados para buscadores.',
    includes: [
      'Diseno propio, sin plantillas genericas',
      'Adaptado a movil, tableta y escritorio',
      'Optimizacion de velocidad y posicionamiento',
      'Gestor de contenidos para actualizarlo sin depender de nosotros',
    ],
  },
  {
    slug: 'sistemas-web',
    icon: MonitorSmartphoneIcon,
    title: 'Sistemas web',
    summary:
      'Aplicaciones de gestion adaptadas a como trabaja cada organizacion, no al reves.',
    includes: [
      'Analisis previo del proceso real de trabajo',
      'Roles y permisos por tipo de usuario',
      'Informes y exportaciones de datos',
      'Integracion con los sistemas que ya usas',
    ],
  },
  {
    slug: 'aulas-virtuales',
    icon: GraduationCapIcon,
    title: 'Aulas virtuales',
    summary:
      'Plataformas de formacion en linea, con su despliegue, personalizacion y soporte al profesorado.',
    includes: [
      'Instalacion y configuracion completa',
      'Personalizacion con la imagen del centro',
      'Alta de cursos, matriculas y calificaciones',
      'Formacion al equipo docente',
    ],
  },
  {
    slug: 'hosting',
    icon: ServerIcon,
    title: 'Hosting',
    summary: 'Alojamiento gestionado, con copias de seguridad y vigilancia del servicio.',
    includes: [
      'Servidores con supervision continua',
      'Copias de seguridad automaticas y verificadas',
      'Certificados SSL incluidos y renovados solos',
      'Migracion desde tu proveedor actual',
    ],
  },
  {
    slug: 'dominios',
    icon: GlobeIcon,
    title: 'Dominios',
    summary: 'Registro, renovacion y configuracion de DNS, sin sorpresas de caducidad.',
    includes: [
      'Registro y transferencia de dominios',
      'Aviso anticipado antes de cada renovacion',
      'Configuracion de registros DNS',
      'Proteccion de datos del titular',
    ],
  },
  {
    slug: 'correo-corporativo',
    icon: MailIcon,
    title: 'Correo corporativo',
    summary: 'Buzones con el dominio de tu empresa, configurados en todos los dispositivos.',
    includes: [
      'Buzones profesionales con tu dominio',
      'Configuracion en movil, escritorio y web',
      'Filtro de correo no deseado',
      'Registros SPF, DKIM y DMARC para que tus correos lleguen',
    ],
  },
  {
    slug: 'bases-de-datos',
    icon: DatabaseIcon,
    title: 'Bases de datos',
    summary: 'Diseno, migracion, optimizacion y respaldo de la informacion que sostiene tu negocio.',
    includes: [
      'Modelado y normalizacion del esquema',
      'Migraciones sin perdida de datos',
      'Optimizacion de consultas lentas',
      'Politica de copias y plan de recuperacion',
    ],
  },
];

export interface ProcessStep {
  icon: LucideIcon;
  title: string;
  description: string;
}

/** Como se atiende una incidencia, de principio a fin. */
export const PROCESS: ProcessStep[] = [
  {
    icon: TicketIcon,
    title: 'Registras la incidencia',
    description:
      'Cada aviso recibe un codigo unico. Nada se pierde en una cadena de correos ni en un chat de grupo.',
  },
  {
    icon: GaugeCircleIcon,
    title: 'Se clasifica y se prioriza',
    description:
      'Cada categoria tiene su tiempo objetivo de primera respuesta y de resolucion. Lo critico se trata como critico.',
  },
  {
    icon: RouteIcon,
    title: 'Se asigna y se resuelve',
    description:
      'Un responsable concreto, con toda la conversacion en un unico hilo y sin repetir explicaciones.',
  },
  {
    icon: ShieldCheckIcon,
    title: 'Queda todo registrado',
    description:
      'Historial completo de cambios y tiempos. Puedes consultar que paso, quien lo hizo y cuando.',
  },
];

export interface Differentiator {
  icon: LucideIcon;
  title: string;
  description: string;
}

export const DIFFERENTIATORS: Differentiator[] = [
  {
    icon: LifeBuoyIcon,
    title: 'Quien desarrolla, atiende',
    description:
      'No explicas tu infraestructura cada vez: el equipo que construyo tu sistema es el que responde cuando falla.',
  },
  {
    icon: ClockIcon,
    title: 'Tiempos que se miden',
    description:
      'Los objetivos de respuesta y resolucion no son una promesa comercial: se calculan sobre los datos reales.',
  },
  {
    icon: BookOpenIcon,
    title: 'Conocimiento que se acumula',
    description:
      'Cada solucion se documenta. La segunda vez que ocurre algo parecido, se resuelve mas rapido.',
  },
  {
    icon: UsersIcon,
    title: 'Un unico interlocutor',
    description:
      'Web, hosting, dominio, correo y base de datos. Sin derivaciones entre proveedores cuando algo deja de funcionar.',
  },
];

export interface FaqEntry {
  question: string;
  answer: string;
}

export const FAQ: FaqEntry[] = [
  {
    question: 'Como registro una incidencia?',
    answer:
      'Desde el area de soporte, con las credenciales que te facilitamos. Cada incidencia recibe un codigo con el que puedes seguir su estado en todo momento.',
  },
  {
    question: 'Que pasa si mi web se cae fuera de horario?',
    answer:
      'Las incidencias criticas —servicio caido o datos en riesgo— se tratan con prioridad maxima y avisan al equipo en el momento en que se registran.',
  },
  {
    question: 'Puedo pedir soporte de algo que no desarrollasteis vosotros?',
    answer:
      'Si. Revisamos el estado de lo que tengas, te decimos con claridad que se puede mantener y que conviene rehacer, y damos un presupuesto antes de tocar nada.',
  },
  {
    question: 'Como se que se ha hecho lo que se dijo?',
    answer:
      'Cada cambio queda en el historial del ticket con su autor y su fecha. No hay trabajo sin registro.',
  },
];
