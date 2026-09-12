-- CreateTable
CREATE TABLE "GoalSubscription" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "league" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "revision" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoalSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalSnapshot" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "revision" TEXT NOT NULL,
    "ownScore" INTEGER NOT NULL,
    "otherScore" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoalSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalNotice" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "revision" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GoalNotice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoalSubscription_channelId_key" ON "GoalSubscription"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "GoalSnapshot_subscriptionId_eventId_key" ON "GoalSnapshot"("subscriptionId", "eventId");

-- CreateIndex
CREATE INDEX "GoalNotice_sentAt_createdAt_idx" ON "GoalNotice"("sentAt", "createdAt");

-- AddForeignKey
ALTER TABLE "GoalSnapshot" ADD CONSTRAINT "GoalSnapshot_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "GoalSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalNotice" ADD CONSTRAINT "GoalNotice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "GoalSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

