-- CreateEnum
CREATE TYPE "RateType" AS ENUM ('CDI_PERCENTAGE', 'IPCA_PLUS');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('RENDA_FIXA', 'FII');

-- CreateEnum
CREATE TYPE "OperationType" AS ENUM ('NEW_POSITION', 'EXISTING_POSITION');

-- CreateEnum
CREATE TYPE "IndexType" AS ENUM ('CDI', 'IPCA');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "googleId" TEXT,
    "name" TEXT,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RendaFixa" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "institution" VARCHAR(100) NOT NULL,
    "investedAmount" DECIMAL(14,2) NOT NULL,
    "maturityDate" TIMESTAMP(3) NOT NULL,
    "rateType" "RateType" NOT NULL,
    "rateValue" DECIMAL(6,4) NOT NULL,
    "ipcaPlusRate" DECIMAL(5,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RendaFixa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FII" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ticker" VARCHAR(6) NOT NULL,
    "shares" INTEGER NOT NULL,
    "averagePrice" DECIMAL(10,2) NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FII_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FIIQuote" (
    "id" TEXT NOT NULL,
    "fiiId" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "sourceDate" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FIIQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FIIDividend" (
    "id" TEXT NOT NULL,
    "fiiId" TEXT NOT NULL,
    "dividendPerShare" DECIMAL(10,6) NOT NULL,
    "dividendYield" DECIMAL(5,2) NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FIIDividend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aporte" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "rendaFixaId" TEXT,
    "fiiId" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "shares" INTEGER,
    "pricePerShare" DECIMAL(10,2),
    "operationType" "OperationType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Aporte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketIndex" (
    "id" TEXT NOT NULL,
    "indexType" "IndexType" NOT NULL,
    "value" DECIMAL(10,6) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketIndex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CronLog" (
    "id" TEXT NOT NULL,
    "executionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "successCount" INTEGER NOT NULL,
    "failureCount" INTEGER NOT NULL,
    "errors" JSONB,
    "duration" INTEGER NOT NULL,

    CONSTRAINT "CronLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "RendaFixa_userId_idx" ON "RendaFixa"("userId");

-- CreateIndex
CREATE INDEX "FII_userId_idx" ON "FII"("userId");

-- CreateIndex
CREATE INDEX "FIIQuote_fiiId_updatedAt_idx" ON "FIIQuote"("fiiId", "updatedAt");

-- CreateIndex
CREATE INDEX "FIIDividend_fiiId_paymentDate_idx" ON "FIIDividend"("fiiId", "paymentDate");

-- CreateIndex
CREATE INDEX "Aporte_userId_date_idx" ON "Aporte"("userId", "date");

-- CreateIndex
CREATE INDEX "MarketIndex_indexType_date_idx" ON "MarketIndex"("indexType", "date");

-- CreateIndex
CREATE UNIQUE INDEX "MarketIndex_indexType_date_key" ON "MarketIndex"("indexType", "date");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RendaFixa" ADD CONSTRAINT "RendaFixa_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FII" ADD CONSTRAINT "FII_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FIIQuote" ADD CONSTRAINT "FIIQuote_fiiId_fkey" FOREIGN KEY ("fiiId") REFERENCES "FII"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FIIDividend" ADD CONSTRAINT "FIIDividend_fiiId_fkey" FOREIGN KEY ("fiiId") REFERENCES "FII"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aporte" ADD CONSTRAINT "Aporte_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aporte" ADD CONSTRAINT "Aporte_rendaFixaId_fkey" FOREIGN KEY ("rendaFixaId") REFERENCES "RendaFixa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aporte" ADD CONSTRAINT "Aporte_fiiId_fkey" FOREIGN KEY ("fiiId") REFERENCES "FII"("id") ON DELETE SET NULL ON UPDATE CASCADE;
