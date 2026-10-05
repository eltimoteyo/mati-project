-- @noTransaction
-- Agregar WHATSAPP como fuente de mensaje: para recibir y responder
-- conversaciones de clientes que escriben por WhatsApp.
ALTER TYPE "MessageSource" ADD VALUE 'WHATSAPP';
