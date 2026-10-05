/**
 * Articulos de demostracion para la base de conocimiento.
 *
 * Recogen procedimientos reales del tipo de servicio que presta CONIT, para
 * que el modulo se pueda evaluar con contenido verosimil en lugar de con
 * relleno. Viven aparte de `seed.ts` porque su cuerpo es largo y mezclarlo con
 * el resto del sembrado haria ilegible el fichero principal.
 *
 * Como toda la demostracion, solo se siembran con `SEED_DEMO_DATA=true`.
 */

export interface DemoArticle {
  title: string;
  /** Se declara explicito, igual que en las categorias de referencia. */
  slug: string;
  summary: string;
  content: string;
  /** Slug de la categoria de referencia a la que pertenece. */
  category: string;
  isPublished: boolean;
}

export const DEMO_ARTICLES: DemoArticle[] = [
  {
    title: 'Renovar un certificado SSL antes de que caduque',
    slug: 'renovar-certificado-ssl',
    summary: 'Procedimiento para renovar e instalar el certificado sin cortar el servicio.',
    category: 'hosting-y-dominios',
    isPublished: true,
    content: `## Cuando aplicar

El aviso de caducidad llega 30 dias antes. Conviene renovar con al menos una
semana de margen: la propagacion no es inmediata y un certificado vencido deja
el sitio inaccesible para todos los usuarios.

## Comprobar la fecha actual

\`\`\`
openssl s_client -connect dominio.com:443 -servername dominio.com < /dev/null | openssl x509 -noout -dates
\`\`\`

## Pasos

1. Genera la solicitud (CSR) desde el panel del hosting.
2. Valida la propiedad del dominio por DNS o por fichero.
3. Instala el certificado junto con la cadena intermedia completa.
4. Reinicia el servidor web para que tome el nuevo certificado.
5. Verifica con el comando anterior que la fecha es la esperada.

> Si el navegador sigue avisando tras instalarlo, pide al cliente que recargue
> con **Ctrl+F5**: la version antigua queda guardada en la cache local.`,
  },
  {
    title: 'Los correos corporativos llegan a spam en Gmail',
    slug: 'correos-corporativos-en-spam',
    summary: 'Revision de SPF, DKIM y DMARC cuando el correo del cliente deja de entregarse.',
    category: 'correo-corporativo',
    isPublished: true,
    content: `## Diagnostico

Casi siempre es un problema de autenticacion del dominio, no del servidor de
correo. Revisa los tres registros en este orden.

## 1. SPF

Debe existir un unico registro TXT que empiece por \`v=spf1\` e incluya al
proveedor de envio. Dos registros SPF invalidan ambos.

## 2. DKIM

Comprueba que el selector publicado coincide con el que firma los mensajes
salientes. Un selector rotado y no actualizado en el DNS rompe la firma sin
dar ningun error visible.

## 3. DMARC

Empieza en \`p=none\` para observar los informes antes de endurecer la politica.
Pasar directo a \`p=reject\` con SPF o DKIM mal configurados tumba la entrega
por completo.

## Verificacion

1. Envia un correo de prueba a una cuenta de Gmail.
2. Abre *Mostrar original* y comprueba que SPF, DKIM y DMARC dicen PASS.
3. Si alguno falla, corrige el registro y espera a la propagacion DNS.`,
  },
  {
    title: 'Restaurar una copia de seguridad de la base de datos',
    slug: 'restaurar-copia-de-seguridad',
    summary: 'Restauracion de un respaldo de PostgreSQL sin perder los datos actuales.',
    category: 'base-de-datos',
    isPublished: true,
    content: `## Antes de empezar

Nunca restaures sobre la base de datos en produccion. Restaura primero en una
base temporal, comprueba el contenido y solo entonces decide.

## Restauracion en una base temporal

\`\`\`
createdb -h localhost -U postgres restauracion_temporal
pg_restore -h localhost -U postgres -d restauracion_temporal respaldo.dump
\`\`\`

## Comprobaciones minimas

1. Cuenta las filas de las tablas principales y comparalas con lo esperado.
2. Revisa que la fecha del ultimo registro coincide con la del respaldo.
3. Confirma que las secuencias quedaron en el valor correcto.

## Puesta en produccion

Solo cuando las comprobaciones pasen: para la aplicacion, renombra la base
actual como respaldo de seguridad, renombra la restaurada y vuelve a levantar
el servicio.`,
  },
  {
    title: 'Error 500 al guardar matriculas en el aula virtual',
    slug: 'error-500-al-guardar-matriculas',
    summary: 'Causas habituales del error al matricular y como aislarlas.',
    category: 'aula-virtual',
    isPublished: false,
    content: `## Sintoma

El formulario de matricula devuelve un error 500 al guardar, sin mensaje para
el usuario.

## Causas mas frecuentes

- Disco lleno en el servidor: el registro no puede escribirse.
- Limite de memoria de PHP superado con cargas masivas.
- Una restriccion de unicidad que salta con un documento repetido.

## Como aislarlo

1. Revisa el log de la aplicacion en el momento exacto del error.
2. Reproduce con un solo alumno: si funciona, es un problema de volumen.
3. Comprueba el espacio en disco antes de tocar nada mas.

> Borrador pendiente de completar con el detalle de los limites de memoria
> recomendados segun el numero de alumnos.`,
  },
];
