-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dailyAt" TIMESTAMP(3),
ADD COLUMN     "starterAt" TIMESTAMP(3),
ADD COLUMN     "streak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "workAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "UserCard" ADD COLUMN     "destroyedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CardArtwork" (
    "cardId" TEXT NOT NULL,
    "png" BYTEA NOT NULL,
    "sha256" TEXT NOT NULL,

    CONSTRAINT "CardArtwork_pkey" PRIMARY KEY ("cardId")
);

-- CreateTable
CREATE TABLE "EconomyOperation" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EconomyOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "delta" BIGINT NOT NULL,
    "balance" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketListing" (
    "id" TEXT NOT NULL,
    "userCardId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "buyerId" TEXT,
    "price" BIGINT NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeOffer" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "offeredId" TEXT NOT NULL,
    "wantedId" TEXT NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'OPEN',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradeOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WalletEntry_userId_createdAt_idx" ON "WalletEntry"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "MarketListing_status_createdAt_idx" ON "MarketListing"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TradeOffer_status_expiresAt_idx" ON "TradeOffer"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "TradeOffer_recipientId_status_idx" ON "TradeOffer"("recipientId", "status");

-- AddForeignKey
ALTER TABLE "CardArtwork" ADD CONSTRAINT "CardArtwork_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletEntry" ADD CONSTRAINT "WalletEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletEntry" ADD CONSTRAINT "WalletEntry_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "EconomyOperation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketListing" ADD CONSTRAINT "MarketListing_userCardId_fkey" FOREIGN KEY ("userCardId") REFERENCES "UserCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeOffer" ADD CONSTRAINT "TradeOffer_offeredId_fkey" FOREIGN KEY ("offeredId") REFERENCES "UserCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeOffer" ADD CONSTRAINT "TradeOffer_wantedId_fkey" FOREIGN KEY ("wantedId") REFERENCES "UserCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "MarketListing" ADD CONSTRAINT "market_price_positive" CHECK (price > 0 AND price <= 1000000);
ALTER TABLE "WalletEntry" ADD CONSTRAINT "wallet_balance_nonnegative" CHECK (balance >= 0);
CREATE UNIQUE INDEX "one_open_listing_per_copy" ON "MarketListing" ("userCardId") WHERE status = 'OPEN';
CREATE UNIQUE INDEX "one_open_trade_per_copy" ON "TradeOffer" ("offeredId") WHERE status = 'OPEN';
