-- CreateTable
CREATE TABLE "TestPlanItem" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TestPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TestPlanItem_planId_testCaseId_key" ON "TestPlanItem"("planId", "testCaseId");

-- CreateIndex
CREATE INDEX "TestPlanItem_planId_idx" ON "TestPlanItem"("planId");

-- CreateIndex
CREATE INDEX "TestPlanItem_testCaseId_idx" ON "TestPlanItem"("testCaseId");

-- AddForeignKey
ALTER TABLE "TestPlanItem" ADD CONSTRAINT "TestPlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TestPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestPlanItem" ADD CONSTRAINT "TestPlanItem_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
