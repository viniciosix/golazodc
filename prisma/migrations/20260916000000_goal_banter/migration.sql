ALTER TABLE "GoalNotice" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'legacy';
CREATE TABLE "GoalBanter" (
 "channelId" TEXT NOT NULL,
 "guildId" TEXT NOT NULL,
 "enabled" BOOLEAN NOT NULL DEFAULT true,
 CONSTRAINT "GoalBanter_pkey" PRIMARY KEY ("channelId")
);
