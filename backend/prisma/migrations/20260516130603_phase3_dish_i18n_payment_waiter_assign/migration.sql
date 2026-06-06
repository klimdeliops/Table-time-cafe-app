-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD');

-- AlterTable
ALTER TABLE "dishes" ADD COLUMN     "nameEn" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "paymentMethod" "PaymentMethod";

-- AlterTable
ALTER TABLE "tables" ADD COLUMN     "assignedWaiterId" TEXT;

-- CreateIndex
CREATE INDEX "tables_assignedWaiterId_idx" ON "tables"("assignedWaiterId");

-- AddForeignKey
ALTER TABLE "tables" ADD CONSTRAINT "tables_assignedWaiterId_fkey" FOREIGN KEY ("assignedWaiterId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
