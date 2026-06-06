-- AlterEnum
ALTER TYPE "TableStatus" ADD VALUE 'CLEANING';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "deliveryAddress" TEXT,
ADD COLUMN     "reservationId" TEXT;

-- CreateIndex
CREATE INDEX "orders_tableId_idx" ON "orders"("tableId");

-- CreateIndex
CREATE INDEX "orders_reservationId_idx" ON "orders"("reservationId");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
