-- AlterEnum
ALTER TYPE "MessageSource" ADD VALUE 'AI';

-- AlterTable
ALTER TABLE "whatsapp_conversations" ADD COLUMN     "ai_paused_until" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "whatsapp_messages" ADD COLUMN     "ai_generated" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "app_settings" (
    "key" VARCHAR(80) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);
