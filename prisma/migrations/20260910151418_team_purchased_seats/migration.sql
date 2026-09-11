-- AlterTable
ALTER TABLE "team_billing_account" ADD COLUMN     "includedSeats" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pendingSeatEffectiveAt" TIMESTAMP(3),
ADD COLUMN     "pendingSeatQuantity" INTEGER,
ADD COLUMN     "seatPeriodEnd" TIMESTAMP(3),
ADD COLUMN     "seatQuantity" INTEGER,
ADD COLUMN     "seatScheduleId" TEXT,
ADD COLUMN     "seatSubscriptionItemId" TEXT;
