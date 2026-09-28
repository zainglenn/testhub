-- AlterTable
ALTER TABLE "TestPlan" ADD COLUMN     "testSetId" TEXT;

-- CreateIndex
CREATE INDEX "TestPlan_testSetId_idx" ON "TestPlan"("testSetId");

-- AddForeignKey
ALTER TABLE "TestPlan" ADD CONSTRAINT "TestPlan_testSetId_fkey" FOREIGN KEY ("testSetId") REFERENCES "TestSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
