CREATE TABLE "ModerationConfig" (
  "guildId" TEXT NOT NULL,
  "muteRoleId" TEXT,
  "logChannelId" TEXT,
  "filterEnabled" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "ModerationConfig_pkey" PRIMARY KEY ("guildId")
);

CREATE TABLE "ModerationWord" (
  "id" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "normalized" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModerationWord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModerationWarning" (
  "id" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "moderatorId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModerationWarning_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModerationMute" (
  "id" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "moderatorId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "roleIds" TEXT[] NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  CONSTRAINT "ModerationMute_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModerationWord_guildId_normalized_key" ON "ModerationWord"("guildId", "normalized");
CREATE INDEX "ModerationWord_guildId_idx" ON "ModerationWord"("guildId");
CREATE INDEX "ModerationWarning_guildId_userId_createdAt_idx" ON "ModerationWarning"("guildId", "userId", "createdAt");
CREATE INDEX "ModerationMute_active_expiresAt_idx" ON "ModerationMute"("active", "expiresAt");
CREATE INDEX "ModerationMute_guildId_userId_active_idx" ON "ModerationMute"("guildId", "userId", "active");
CREATE UNIQUE INDEX "one_active_mute_per_member" ON "ModerationMute"("guildId", "userId") WHERE "active" = true;
