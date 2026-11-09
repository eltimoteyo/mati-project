-- CreateEnum
CREATE TYPE "IdentityStatus" AS ENUM ('UNKNOWN', 'CLAIMED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "SupportStage" AS ENUM ('IDENTIFYING', 'TRIAGE', 'TROUBLESHOOTING', 'ESCALATED', 'FOLLOW_UP', 'RESOLVED', 'ABANDONED');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "technical" JSONB;

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "default_assignee_id" UUID;

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "satisfaction" INTEGER,
ADD COLUMN     "satisfaction_comment" VARCHAR(500);

-- AlterTable
ALTER TABLE "articles" ADD COLUMN     "guidance" JSONB;

-- AlterTable
ALTER TABLE "whatsapp_conversations" ADD COLUMN     "identified_at" TIMESTAMP(3),
ADD COLUMN     "identified_by" VARCHAR(20),
ADD COLUMN     "identity_status" "IdentityStatus" NOT NULL DEFAULT 'UNKNOWN';

-- AlterTable
ALTER TABLE "whatsapp_messages" ADD COLUMN     "feedback" INTEGER,
ADD COLUMN     "feedback_reason" VARCHAR(500),
ADD COLUMN     "media_id" VARCHAR(200),
ADD COLUMN     "media_path" VARCHAR(300),
ADD COLUMN     "media_processed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mime_type" VARCHAR(100),
ADD COLUMN     "transcript" TEXT;

-- CreateTable
CREATE TABLE "client_contacts" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(32) NOT NULL,
    "email" VARCHAR(180),
    "role" VARCHAR(100),
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_cases" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "client_id" UUID,
    "ticket_id" UUID,
    "stage" "SupportStage" NOT NULL DEFAULT 'IDENTIFYING',
    "facts" JSONB NOT NULL DEFAULT '{}',
    "steps_tried" JSONB NOT NULL DEFAULT '[]',
    "summary" TEXT NOT NULL DEFAULT '',
    "solution" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_inbound_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "support_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auto_reply_jobs" (
    "conversation_id" UUID NOT NULL,
    "run_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "locked_at" TIMESTAMP(3),
    "lock_token" UUID,

    CONSTRAINT "auto_reply_jobs_pkey" PRIMARY KEY ("conversation_id")
);

-- CreateTable
CREATE TABLE "identity_challenges" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "code_hash" CHAR(64) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "identity_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_turns" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "case_id" UUID,
    "model" TEXT NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost" DOUBLE PRECISION,
    "action" VARCHAR(30) NOT NULL,
    "error" VARCHAR(300),
    "tools" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_turns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_chunks" (
    "id" UUID NOT NULL,
    "article_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" JSONB,
    "model" TEXT,

    CONSTRAINT "article_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_cache" (
    "key" VARCHAR(300) NOT NULL,
    "result" JSONB NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diagnostic_cache_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "service_incidents" (
    "id" UUID NOT NULL,
    "host" VARCHAR(250) NOT NULL,
    "summary" TEXT NOT NULL,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "service_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_contacts_phone_idx" ON "client_contacts"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "client_contacts_client_id_phone_key" ON "client_contacts"("client_id", "phone");

-- CreateIndex
CREATE INDEX "support_cases_conversation_id_closed_at_idx" ON "support_cases"("conversation_id", "closed_at");

-- CreateIndex
CREATE INDEX "auto_reply_jobs_run_at_idx" ON "auto_reply_jobs"("run_at");

-- CreateIndex
CREATE INDEX "identity_challenges_conversation_id_created_at_idx" ON "identity_challenges"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_turns_created_at_idx" ON "ai_turns"("created_at");

-- CreateIndex
CREATE INDEX "ai_turns_conversation_id_created_at_idx" ON "ai_turns"("conversation_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "article_chunks_article_id_position_key" ON "article_chunks"("article_id", "position");

-- CreateIndex
CREATE INDEX "diagnostic_cache_expires_at_idx" ON "diagnostic_cache"("expires_at");

-- CreateIndex
CREATE INDEX "service_incidents_host_closed_at_idx" ON "service_incidents"("host", "closed_at");

-- AddForeignKey
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "whatsapp_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_reply_jobs" ADD CONSTRAINT "auto_reply_jobs_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "whatsapp_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_challenges" ADD CONSTRAINT "identity_challenges_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "whatsapp_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_turns" ADD CONSTRAINT "ai_turns_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "whatsapp_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_turns" ADD CONSTRAINT "ai_turns_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "support_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_chunks" ADD CONSTRAINT "article_chunks_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Invariantes que Prisma no expresa en su DSL.
ALTER TABLE client_contacts ADD COLUMN deleted_at TIMESTAMP(3);
CREATE UNIQUE INDEX support_cases_one_open_per_conversation ON support_cases(conversation_id) WHERE closed_at IS NULL;
CREATE UNIQUE INDEX service_incidents_one_open_per_host ON service_incidents(host) WHERE closed_at IS NULL;
ALTER TABLE tickets ADD CONSTRAINT tickets_satisfaction_range CHECK (satisfaction IS NULL OR satisfaction BETWEEN 1 AND 5);
ALTER TABLE whatsapp_messages ADD CONSTRAINT whatsapp_feedback_range CHECK (feedback IS NULL OR feedback IN (-1, 1));
ALTER TABLE support_cases ADD CONSTRAINT support_case_attempts_range CHECK (attempts BETWEEN 0 AND 2);

-- Conserva el teléfono original, normalizado como lo envía Meta: solo dígitos y
-- con código de país (un móvil peruano de 9 dígitos recibe el 51, igual que en
-- normalizePhone). Un número ambiguo nunca autentica una empresa.
INSERT INTO client_contacts (id, client_id, name, phone, email, verified_at)
SELECT gen_random_uuid(), c.id, left(coalesce(c.contact_name, c.name), 120),
  CASE
    WHEN ficha.digits ~ '^9[0-9]{8}$' THEN '51' || ficha.digits
    WHEN ficha.digits LIKE '00%' THEN substring(ficha.digits FROM 3)
    ELSE ficha.digits
  END,
  c.email, NOW()
FROM clients c
CROSS JOIN LATERAL (
  SELECT regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g') AS digits
) AS ficha
WHERE length(ficha.digits) BETWEEN 8 AND 15
ON CONFLICT (client_id, phone) DO NOTHING;

UPDATE whatsapp_conversations w SET identity_status = 'VERIFIED', identified_by = 'PHONE', identified_at = NOW()
WHERE client_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM client_contacts cc WHERE cc.client_id = w.client_id AND cc.phone = w.phone AND cc.verified_at IS NOT NULL
) AND (SELECT count(DISTINCT client_id) FROM client_contacts WHERE phone = w.phone AND verified_at IS NOT NULL) = 1;

-- Los vínculos antiguos que usaban coincidencia parcial se verifican antes de exponer datos.
UPDATE whatsapp_conversations SET identity_status = 'CLAIMED' WHERE client_id IS NOT NULL AND identity_status = 'UNKNOWN';

-- Recupera mensajes pendientes al desplegar. El trabajador vuelve a comprobar pausa y ventana.
INSERT INTO auto_reply_jobs (conversation_id, run_at)
SELECT w.id, NOW() + interval '6 seconds' FROM whatsapp_conversations w
WHERE w.last_inbound_at > NOW() - interval '24 hours'
  AND (SELECT direction FROM whatsapp_messages WHERE conversation_id = w.id ORDER BY created_at DESC LIMIT 1) = 'INBOUND'
ON CONFLICT (conversation_id) DO NOTHING;
