import {
  actionButton,
  BRAND,
  type EmailAction,
  escapeHtml,
  pill,
  renderShell,
  toParagraphs,
} from './email-base';

/**
 * Plantilla de los correos de incidencia.
 *
 * La estructura comun —cabecera de marca, boton, pie y envoltorio— vive en
 * `email-base`. Aqui queda solo lo propio de un ticket: los colores de estado
 * y prioridad, la tabla de datos y el bloque destacado.
 */

/** Colores de cada estado, en el mismo criterio que el panel. */
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  NEW: { bg: '#EFF6FF', text: '#1D4ED8' },
  IN_REVIEW: { bg: '#F5F3FF', text: '#6D28D9' },
  IN_PROGRESS: { bg: '#FFF7ED', text: '#C2410C' },
  RESOLVED: { bg: '#F0FDF4', text: '#15803D' },
  CLOSED: { bg: '#F1F5F9', text: '#475569' },
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  LOW: { bg: '#F1F5F9', text: '#475569' },
  MEDIUM: { bg: '#EFF6FF', text: '#1D4ED8' },
  HIGH: { bg: '#FFF7ED', text: '#C2410C' },
  CRITICAL: { bg: '#FEF2F2', text: '#B91C1C' },
};

export interface TicketEmailRow {
  label: string;
  value: string;
}

export interface TicketEmailData {
  /** Titulo grande de la cabecera, por ejemplo "Hemos recibido tu incidencia". */
  heading: string;
  /** Frase introductoria bajo el titulo. */
  intro: string;
  ticketCode: string;
  subject: string;
  statusLabel: string;
  statusKey: string;
  priorityLabel: string;
  priorityKey: string;
  rows: TicketEmailRow[];
  /** Bloque destacado opcional: la descripcion o el ultimo mensaje. */
  highlight?: { title: string; body: string } | null;
  /** Enlace de accion. Se omite el boton si no hay URL. */
  action?: EmailAction | null;
  /** `cid:...` para el logo incrustado, o una URL publica. */
  logoSrc?: string | undefined;
  /** Texto del pie, bajo los datos de contacto. */
  footerNote: string;
}

/** Tabla de datos del ticket. */
function detailsTable(rows: TicketEmailRow[]): string {
  if (rows.length === 0) return '';

  const cells = rows
    .map(
      (row, index) => `
      <tr>
        <td style="padding:${index === 0 ? '0' : '10px'} 0 0;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:13px;color:${BRAND.muted};width:38%;vertical-align:top;">
          ${escapeHtml(row.label)}
        </td>
        <td style="padding:${index === 0 ? '0' : '10px'} 0 0;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:${BRAND.ink};vertical-align:top;">
          ${escapeHtml(row.value)}
        </td>
      </tr>`,
    )
    .join('');

  return `
    <tr>
      <td style="padding:0 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
               style="background-color:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:10px;">
          <tr>
            <td style="padding:20px 22px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                ${cells}
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr><td style="height:24px;font-size:0;line-height:0;">&nbsp;</td></tr>`;
}

/** Bloque destacado con la descripcion o el ultimo mensaje. */
function highlightBlock(highlight: TicketEmailData['highlight']): string {
  if (!highlight) return '';

  return `
    <tr>
      <td style="padding:0 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
               style="border-left:3px solid ${BRAND.blue};background-color:${BRAND.white};border-top:1px solid ${BRAND.border};border-right:1px solid ${BRAND.border};border-bottom:1px solid ${BRAND.border};border-radius:0 10px 10px 0;">
          <tr>
            <td style="padding:18px 22px;">
              <div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${BRAND.muted};margin-bottom:10px;">
                ${escapeHtml(highlight.title)}
              </div>
              <div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.65;color:${BRAND.body};">
                ${toParagraphs(highlight.body)}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr><td style="height:28px;font-size:0;line-height:0;">&nbsp;</td></tr>`;
}

/** Compone el correo completo. */
export function renderTicketEmail(data: TicketEmailData): string {
  const statusColors = STATUS_COLORS[data.statusKey] ?? STATUS_COLORS.NEW!;
  const priorityColors = PRIORITY_COLORS[data.priorityKey] ?? PRIORITY_COLORS.MEDIUM!;

  const content = `
    <tr>
      <td class="conit-pad" style="padding:36px 40px 0;">
        <div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.14em;color:${BRAND.blue};">
          ${escapeHtml(data.ticketCode)}
        </div>
        <h1 style="margin:10px 0 0;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:22px;line-height:1.35;font-weight:700;color:${BRAND.ink};">
          ${escapeHtml(data.heading)}
        </h1>
        <p style="margin:12px 0 0;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:${BRAND.body};">
          ${toParagraphs(data.intro)}
        </p>
      </td>
    </tr>

    <tr><td style="height:24px;font-size:0;line-height:0;">&nbsp;</td></tr>

    <tr>
      <td class="conit-pad" style="padding:0 40px;">
        <div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:16px;font-weight:600;line-height:1.5;color:${BRAND.ink};">
          ${escapeHtml(data.subject)}
        </div>
        <div style="margin-top:12px;">
          ${pill(data.statusLabel, statusColors)}
          &nbsp;
          ${pill(data.priorityLabel, priorityColors)}
        </div>
      </td>
    </tr>

    <tr><td style="height:24px;font-size:0;line-height:0;">&nbsp;</td></tr>

    ${detailsTable(data.rows)}
    ${highlightBlock(data.highlight)}
    ${actionButton(data.action)}`;

  return renderShell({
    title: `${data.ticketCode} · ${data.subject}`,
    preheader: `${data.ticketCode} · ${data.intro}`,
    content,
    logoSrc: data.logoSrc,
    footerNote: data.footerNote,
  });
}

/**
 * Version en texto plano.
 *
 * Se envia siempre junto al HTML: mejora la entregabilidad y es lo unico que
 * ven los lectores de texto y algunos filtros corporativos.
 */
export function renderTicketEmailText(data: TicketEmailData): string {
  const lines = [
    `CONIT · Soporte tecnico`,
    '',
    `${data.ticketCode} — ${data.subject}`,
    '',
    data.heading,
    data.intro,
    '',
    `Estado: ${data.statusLabel}`,
    `Prioridad: ${data.priorityLabel}`,
    ...data.rows.map((row) => `${row.label}: ${row.value}`),
  ];

  if (data.highlight) {
    lines.push('', `${data.highlight.title.toUpperCase()}:`, data.highlight.body);
  }

  if (data.action) {
    lines.push('', `${data.action.label}: ${data.action.url}`);
  }

  lines.push('', data.footerNote);

  return lines.join('\n');
}
