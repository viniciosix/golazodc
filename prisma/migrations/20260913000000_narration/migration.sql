-- AlterTable
ALTER TABLE "GoalNotice" ADD COLUMN     "eventId" TEXT;

-- CreateTable
CREATE TABLE "MatchNarration" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "revision" TEXT NOT NULL,
    "messageId" TEXT,
    "generation" INTEGER NOT NULL DEFAULT 0,
    "rotate" BOOLEAN NOT NULL DEFAULT false,
    "sinceSequence" INTEGER NOT NULL DEFAULT -1,
    "payloadHash" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchNarration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchNarration_subscriptionId_key" ON "MatchNarration"("subscriptionId");

-- AddForeignKey
ALTER TABLE "MatchNarration" ADD CONSTRAINT "MatchNarration_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "GoalSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

