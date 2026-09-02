-- CreateEnum
CREATE TYPE "MessageSource" AS ENUM ('PANEL', 'EMAIL', 'PORTAL');

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "source" "MessageSource" NOT NULL DEFAULT 'PANEL';
