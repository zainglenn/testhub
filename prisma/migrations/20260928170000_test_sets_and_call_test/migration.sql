-- AlterTable
ALTER TABLE "TestStep" ADD COLUMN     "calledTestCaseId" TEXT;

-- CreateTable
CREATE TABLE "TestSet" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestSetItem" (
    "id" TEXT NOT NULL,
    "testSetId" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TestSetItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TestStep_calledTestCaseId_idx" ON "TestStep"("calledTestCaseId");

-- CreateIndex
CREATE INDEX "TestSet_projectId_idx" ON "TestSet"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "TestSetItem_testSetId_testCaseId_key" ON "TestSetItem"("testSetId", "testCaseId");

-- CreateIndex
CREATE INDEX "TestSetItem_testSetId_idx" ON "TestSetItem"("testSetId");

-- CreateIndex
CREATE INDEX "TestSetItem_testCaseId_idx" ON "TestSetItem"("testCaseId");

-- AddForeignKey
ALTER TABLE "TestStep" ADD CONSTRAINT "TestStep_calledTestCaseId_fkey" FOREIGN KEY ("calledTestCaseId") REFERENCES "TestCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestSet" ADD CONSTRAINT "TestSet_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestSetItem" ADD CONSTRAINT "TestSetItem_testSetId_fkey" FOREIGN KEY ("testSetId") REFERENCES "TestSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestSetItem" ADD CONSTRAINT "TestSetItem_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
