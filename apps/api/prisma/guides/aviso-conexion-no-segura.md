---
title: El navegador dice que la conexión no es segura
slug: aviso-conexion-no-segura
category: hosting-y-dominios
summary: Qué significa el aviso de conexión no segura y cuándo se debe a un problema del certificado SSL.
---
## Qué puede estar pasando

- El certificado de seguridad (SSL) de la web venció.
- Se está entrando con una dirección distinta a la que cubre el certificado, por ejemplo con o sin "www", o con "http" en lugar de "https".
- La fecha y la hora del equipo están mal configuradas, y el navegador cree que el certificado no es válido.
- Un antivirus, un proxy o la red de la empresa interfieren en la conexión.

## Qué puedes probar

1. Comprueba que la fecha y la hora de tu equipo son correctas.
2. Escribe la dirección completa empezando por "https://", y prueba con y sin "www".
3. Abre la web desde el celular con datos móviles.
4. Abre el detalle del aviso: un código como "NET::ERR_CERT_DATE_INVALID" o "certificado caducado" indica que el certificado venció.

## Cuándo avisar a CONIT

- Si el aviso aparece en cualquier dispositivo y red.
- Si el detalle indica que el certificado está caducado o no es válido para el dominio.

Es urgente: mientras dure, los visitantes ven el aviso y muchos no entran a la web.

## Qué datos enviarnos

- La dirección exacta de la web.
- Una captura del aviso con su código de error.
