-- AlterTable
ALTER TABLE "TestExecution" ADD COLUMN     "dataset" TEXT;

-- CreateTable
CREATE TABLE "TestCaseParameter" (
    "id" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "parameterId" TEXT NOT NULL,

    CONSTRAINT "TestCaseParameter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TestCaseParameter_testCaseId_idx" ON "TestCaseParameter"("testCaseId");

-- CreateIndex
CREATE INDEX "TestCaseParameter_parameterId_idx" ON "TestCaseParameter"("parameterId");

-- CreateIndex
CREATE UNIQUE INDEX "TestCaseParameter_testCaseId_parameterId_key" ON "TestCaseParameter"("testCaseId", "parameterId");

-- AddForeignKey
ALTER TABLE "TestCaseParameter" ADD CONSTRAINT "TestCaseParameter_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCaseParameter" ADD CONSTRAINT "TestCaseParameter_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "Parameter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
