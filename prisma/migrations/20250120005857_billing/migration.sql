-- AlterTable
ALTER TABLE "entitlement" ADD COLUMN     "googleDrive" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "billing_account" (
    "userId" UUID NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "subscription" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL,
    "customerId" TEXT NOT NULL,
    "productId" UUID,
    "subscriptionId" TEXT NOT NULL,
    "priceId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_account_userId_key" ON "billing_account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "billing_account_customerId_key" ON "billing_account"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "unique_customer" ON "billing_account"("userId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "unique_subscription" ON "subscription"("userId", "subscriptionId", "priceId");

-- AddForeignKey
ALTER TABLE "billing_account" ADD CONSTRAINT "billing_account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "billing_account"("customerId") ON DELETE CASCADE ON UPDATE CASCADE;
