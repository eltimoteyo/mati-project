/**
 * Renderiza el correo de credenciales a un fichero, para revisar el diseno sin
 * enviar nada.
 *
 *   node scripts/preview-credentials-email.cjs [salida.html]
 */
const { writeFileSync } = require('node:fs');
const { join } = require('node:path');

const {
  renderCredentialsEmail,
} = require('../dist/mail/templates/credentials-email.template');

const output = process.argv[2] ?? join(__dirname, '..', 'credentials-email.preview.html');

const html = renderCredentialsEmail({
  recipientName: 'Contacto Instituto Vallejo',
  clientName: 'Instituto Vallejo',
  email: 'ti@institutovallejo.edu.pe',
  password: 'Kx7mRp2qWnZt4v',
  portalUrl: 'https://conit-support.vercel.app/login',
  // En la vista previa se usa el logo publico: el `cid:` solo resuelve dentro
  // de un correo con el adjunto en linea.
  logoSrc: 'http://localhost:3000/brand/conit-logo.png',
  isReset: false,
});

writeFileSync(output, html, 'utf8');
console.log(`Vista previa escrita en ${output}`);
