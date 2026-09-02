import {
  actionButton,
  BRAND,
  escapeHtml,
  renderShell,
} from './email-base';

/**
 * Correo de bienvenida al portal, con las credenciales de acceso.
 *
 * La contrasena viaja en el mensaje porque es la unica forma de que el cliente
 * pueda entrar la primera vez sin un canal aparte. Para acotar el riesgo, el
 * correo pide expresamente cambiarla al entrar y no repite la contrasena en
 * ninguna otra parte del sistema: no se guarda en claro, de modo que este
 * mensaje es el unico lugar donde existe.
 */

export interface CredentialsEmailData {
  /** Persona a la que se dirige el correo. */
  recipientName: string;
  /** Empresa a la que pertenece. */
  clientName: string;
  email: string;
  password: string;
  /** URL de acceso al portal. */
  portalUrl: string;
  /** `cid:...` para el logo incrustado, o una URL publica. */
  logoSrc?: string | undefined;
  /** `true` cuando se trata de un restablecimiento y no de un alta. */
  isReset: boolean;
}

/** Fila de credencial: etiqueta arriba, valor destacado en monoespaciada. */
function credentialRow(label: string, value: string, isLast: boolean): string {
  return `
    <tr>
      <td style="padding:${isLast ? '14px 0 0' : '0'};">
        <div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${BRAND.muted};">
          ${escapeHtml(label)}
        </div>
        <div style="margin-top:6px;font-family:Consolas,Menlo,Courier New,monospace;font-size:16px;font-weight:600;letter-spacing:0.02em;color:${BRAND.ink};word-break:break-all;">
          ${escapeHtml(value)}
        </div>
      </td>
    </tr>`;
}

export function renderCredentialsEmail(data: CredentialsEmailData): string {
  const heading = data.isReset
    ? 'Hemos restablecido tu acceso'
    : 'Tu acceso al portal de CONIT';

  const intro = data.isReset
    ? `Hemos generado una contrasena nueva para el portal de ${data.clientName}. La anterior ya no funciona.`
    : `Ya puedes entrar al portal de CONIT para registrar incidencias y seguir como avanzan. Estas son tus credenciales de acceso para ${data.clientName}.`;

  const content = `
    <tr>
      <td class="conit-pad" style="padding:36px 40px 0;">
        <div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.14em;color:${BRAND.blue};">
          PORTAL DE CLIENTE
        </div>
        <h1 style="margin:10px 0 0;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:22px;line-height:1.35;font-weight:700;color:${BRAND.ink};">
          ${escapeHtml(heading)}
        </h1>
        <p style="margin:12px 0 0;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:${BRAND.body};">
          Hola ${escapeHtml(data.recipientName)}, ${escapeHtml(intro)}
        </p>
      </td>
    </tr>

    <tr><td style="height:26px;font-size:0;line-height:0;">&nbsp;</td></tr>

    <!-- Credenciales: recuadro con el acento ambar para que salte a la vista. -->
    <tr>
      <td class="conit-pad" style="padding:0 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
               style="border-left:3px solid ${BRAND.amber};background-color:${BRAND.surface};border-top:1px solid ${BRAND.border};border-right:1px solid ${BRAND.border};border-bottom:1px solid ${BRAND.border};border-radius:0 10px 10px 0;">
          <tr>
            <td style="padding:22px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                ${credentialRow('Usuario', data.email, false)}
                ${credentialRow('Contrasena', data.password, true)}
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr><td style="height:24px;font-size:0;line-height:0;">&nbsp;</td></tr>

    <!-- Aviso de seguridad. No es un adorno: este correo lleva una contrasena
         en claro y conviene que quien lo recibe sepa que hacer con el. -->
    <tr>
      <td class="conit-pad" style="padding:0 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
               style="background-color:#FFF7ED;border:1px solid #FED7AA;border-radius:10px;">
          <tr>
            <td style="padding:16px 20px;">
              <div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.65;color:#9A3412;">
                <strong>Cambia la contrasena al entrar.</strong> Por seguridad, borra este correo
                despues de guardarla y no la compartas con nadie. CONIT nunca te pedira tu
                contrasena por telefono ni por correo.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr><td style="height:30px;font-size:0;line-height:0;">&nbsp;</td></tr>

    ${actionButton({ label: 'Entrar al portal', url: data.portalUrl })}`;

  return renderShell({
    title: `${heading} · CONIT`,
    preheader: `${data.email} · ${intro}`,
    content,
    logoSrc: data.logoSrc,
    footerNote:
      'Si no esperabas este correo o crees que te ha llegado por error, avisanos respondiendo a este mensaje.',
  });
}

/**
 * Version en texto plano.
 *
 * Se envia siempre junto al HTML: mejora la entregabilidad y es lo unico que
 * ven los lectores de texto y algunos filtros corporativos.
 */
export function renderCredentialsEmailText(data: CredentialsEmailData): string {
  return [
    'CONIT · Portal de cliente',
    '',
    data.isReset ? 'Hemos restablecido tu acceso' : 'Tu acceso al portal de CONIT',
    '',
    `Hola ${data.recipientName},`,
    data.isReset
      ? `Hemos generado una contrasena nueva para el portal de ${data.clientName}. La anterior ya no funciona.`
      : `Ya puedes entrar al portal de CONIT para registrar incidencias y seguir como avanzan.`,
    '',
    `Usuario: ${data.email}`,
    `Contrasena: ${data.password}`,
    '',
    `Entrar: ${data.portalUrl}`,
    '',
    'Cambia la contrasena al entrar. Borra este correo despues de guardarla y no',
    'la compartas con nadie. CONIT nunca te pedira tu contrasena por telefono ni',
    'por correo.',
    '',
    'Si no esperabas este correo, avisanos respondiendo a este mensaje.',
  ].join('\n');
}
