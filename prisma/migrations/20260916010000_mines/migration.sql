CREATE TABLE "MinesGame" (
 "id" TEXT NOT NULL,
 "userId" TEXT NOT NULL,
 "ownerId" TEXT NOT NULL,
 "activeOwner" TEXT,
 "guildId" TEXT NOT NULL,
 "bet" BIGINT NOT NULL,
 "bombs" INTEGER[] NOT NULL,
 "revealed" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
 "status" TEXT NOT NULL DEFAULT 'ACTIVE',
 "prize" BIGINT NOT NULL DEFAULT 0,
 "revision" INTEGER NOT NULL DEFAULT 0,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "MinesGame_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "MinesGame_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MinesGame_activeOwner_key" ON "MinesGame"("activeOwner");
CREATE INDEX "MinesGame_ownerId_guildId_status_idx" ON "MinesGame"("ownerId", "guildId", "status");
