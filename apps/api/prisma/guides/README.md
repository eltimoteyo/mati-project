# Guías de soporte de primer nivel

Artículos de la base de conocimiento que se siembran en **todos** los entornos,
también en producción. La IA de WhatsApp los usa para explicar al cliente qué
puede estar pasando y qué puede probar antes de crear un ticket, así que su
contenido llega tal cual a los clientes: conviene que alguien de CONIT los
revise.

## Formato

Un fichero `.md` por guía, con una cabecera y el contenido en Markdown:

```markdown
---
title: El correo corporativo no envía mensajes
slug: correo-no-envia-mensajes
category: correo-corporativo
summary: Una frase que resume la guía.
---
## Qué puede estar pasando
...
```

`category` es el slug de una categoría existente.

## Cómo se aplican

- `pnpm db:seed` (local) y `scripts/seed-production.cjs` (contenedor) crean las
  guías que no existan, identificadas por su `slug`.
- **Una guía que ya existe no se sobrescribe**: si el equipo la edita desde el
  panel, sus cambios se conservan. Para publicar una versión nueva de este
  fichero sobre una guía ya creada, hay que editarla desde el panel.
- Este `README.md` no se siembra.
