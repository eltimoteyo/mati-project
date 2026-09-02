/**
 * Piezas comunes de los correos de CONIT.
 *
 * Los correos se componen con tablas y estilos en linea, no con Flexbox ni
 * Grid: Outlook renderiza con el motor de Word y descarta la mayor parte del
 * CSS moderno. Cada decision de aqui abajo esta tomada para que el mensaje se
 * vea igual en Gmail, Outlook y Apple Mail, no para que el HTML sea bonito.
 *
 * Vive aparte porque hay mas de una plantilla (incidencias y credenciales) y
 * la identidad visual debe ser una sola: duplicar los colores garantiza que
 * acaben divergiendo.
 */

/** Identidad visual, tomada del logotipo real de CONIT. */
export const BRAND = {
  blue: '#024A9D',
  blueDark: '#013A7C',
  amber: '#F9AB38',
  ink: '#0F172A',
  body: '#334155',
  muted: '#64748B',
  border: '#E2E8F0',
  surface: '#F8FAFC',
  white: '#FFFFFF',
} as const;

/** Escapa el texto que se interpola: buena parte lo escribe una persona. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Conserva los saltos de linea del texto original dentro del HTML. */
export function toParagraphs(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, '<br />');
}

/** Etiqueta redondeada de estado, prioridad o similar. */
export function pill(label: string, colors: { bg: string; text: string }): string {
  return `<span style="display:inline-block;padding:5px 12px;border-radius:999px;background-color:${colors.bg};color:${colors.text};font-size:12px;font-weight:600;line-height:1;letter-spacing:0.01em;">${escapeHtml(label)}</span>`;
}

/**
 * Cabecera de marca.
 *
 * Fondo blanco, no azul: el logotipo de CONIT es azul marino sobre claro, y
 * colocarlo sobre el azul corporativo lo dejaria ilegible. La franja ambar de
 * debajo aporta el acento de marca sin competir con el simbolo.
 *
 * Si la imagen no se puede incrustar ni enlazar, el `alt` estilizado deja el
 * nombre a la vista en lugar de un hueco roto.
 */
export function header(logoSrc: string | undefined): string {
  const brandMark = logoSrc
    ? `<img src="${escapeHtml(logoSrc)}" width="104" height="137" alt="CONIT Support Desk"
         style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;width:104px;height:auto;color:${BRAND.blue};font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;letter-spacing:0.08em;" />`
    : `<div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:26px;font-weight:700;letter-spacing:0.12em;color:${BRAND.blue};">CONIT</div>
       <div style="margin-top:6px;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:10px;font-weight:600;letter-spacing:0.22em;color:${BRAND.amber};">SUPPORT DESK</div>`;

  return `
    <tr>
      <td align="center" style="background-color:${BRAND.white};padding:34px 24px 26px;">
        ${brandMark}
      </td>
    </tr>
    <tr>
      <td style="height:3px;background-color:${BRAND.blue};font-size:0;line-height:0;">&nbsp;</td>
    </tr>
    <tr>
      <td style="height:3px;background-color:${BRAND.amber};font-size:0;line-height:0;">&nbsp;</td>
    </tr>`;
}

export interface EmailAction {
  label: string;
  url: string;
}

/**
 * Boton de accion.
 *
 * Se envuelve en VML para que Outlook lo pinte como boton solido: sin ese
 * bloque condicional, Outlook ignora el `border-radius` y el relleno y deja un
 * enlace suelto.
 */
export function actionButton(action: EmailAction | null | undefined): string {
  if (!action) return '';

  const url = escapeHtml(action.url);
  const label = escapeHtml(action.label);

  return `
    <tr>
      <td align="center" style="padding:0 40px;">
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
                     href="${url}" style="height:46px;v-text-anchor:middle;width:260px;" arcsize="18%"
                     stroke="f" fillcolor="${BRAND.blue}">
          <w:anchorlock/>
          <center style="color:#FFFFFF;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;">${label}</center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-- -->
        <a href="${url}"
           style="display:inline-block;padding:14px 34px;background-color:${BRAND.blue};color:${BRAND.white};font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;line-height:1;text-decoration:none;border-radius:8px;">
          ${label}
        </a>
        <!--<![endif]-->
      </td>
    </tr>
    <tr><td style="height:32px;font-size:0;line-height:0;">&nbsp;</td></tr>`;
}

/** Separador y pie comunes. */
export function footer(note: string): string {
  return `
    <tr>
      <td style="padding:0 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr><td style="border-top:1px solid ${BRAND.border};font-size:0;line-height:0;">&nbsp;</td></tr>
        </table>
      </td>
    </tr>

    <tr>
      <td class="conit-pad" align="center" style="padding:24px 40px 32px;">
        <div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:${BRAND.muted};">
          ${toParagraphs(note)}
        </div>
        <div style="margin-top:16px;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.1em;color:${BRAND.blue};">
          CONIT
        </div>
        <div style="margin-top:4px;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.6;color:${BRAND.muted};">
          Sitios web · Sistemas web · Aulas virtuales<br />
          Hosting · Dominios · Correo corporativo · Bases de datos
        </div>
      </td>
    </tr>`;
}

export interface ShellOptions {
  /** Titulo de la pestana y del documento. */
  title: string;
  /** Resumen que Gmail y Outlook muestran junto al asunto. */
  preheader: string;
  /** Filas de la tabla central, ya compuestas. */
  content: string;
  logoSrc?: string | undefined;
  footerNote: string;
}

/**
 * Envoltorio comun del correo.
 *
 * Ancho fijo de 600 px —el estandar que respetan todos los clientes— y todo
 * centrado sobre un fondo neutro.
 */
export function renderShell({
  title,
  preheader,
  content,
  logoSrc,
  footerNote,
}: ShellOptions): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escapeHtml(title)}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    /* En movil se reduce el margen lateral para no perder ancho util. */
    @media only screen and (max-width:620px) {
      .conit-shell { width:100% !important; }
      .conit-pad { padding-left:24px !important; padding-right:24px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.surface};-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
    ${escapeHtml(preheader)}
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
         style="background-color:${BRAND.surface};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="conit-shell"
               style="width:600px;max-width:600px;background-color:${BRAND.white};border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.08);">

          ${header(logoSrc)}
          ${content}
          ${footer(footerNote)}
        </table>

        <div style="margin-top:20px;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.6;color:${BRAND.muted};max-width:600px;">
          Este mensaje se ha enviado automaticamente desde el sistema de soporte de CONIT.
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
