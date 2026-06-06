/*
  Warnings:

  - Added the required column `numberOfGuests` to the `reservations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `restaurantId` to the `reservations` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

-- DropIndex
DROP INDEX "reservations_userId_idx";

-- AlterTable
ALTER TABLE "reservations" ADD COLUMN     "numberOfGuests" INTEGER NOT NULL,
ADD COLUMN     "restaurantId" TEXT NOT NULL,
ADD COLUMN     "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "reservations_userId_status_idx" ON "reservations"("userId", "status");

-- CreateIndex
CREATE INDEX "reservations_restaurantId_startTime_idx" ON "reservations"("restaurantId", "startTime");

-- CreateIndex
CREATE INDEX "reservations_status_idx" ON "reservations"("status");

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
