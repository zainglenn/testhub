-- CreateTable
CREATE TABLE "Precondition" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Precondition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreconditionStep" (
    "id" TEXT NOT NULL,
    "preconditionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "expectedResult" TEXT,

    CONSTRAINT "PreconditionStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestCasePrecondition" (
    "id" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "preconditionId" TEXT NOT NULL,

    CONSTRAINT "TestCasePrecondition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Precondition_workspaceId_idx" ON "Precondition"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "PreconditionStep_preconditionId_order_key" ON "PreconditionStep"("preconditionId", "order");

-- CreateIndex
CREATE INDEX "PreconditionStep_preconditionId_idx" ON "PreconditionStep"("preconditionId");

-- CreateIndex
CREATE UNIQUE INDEX "TestCasePrecondition_testCaseId_preconditionId_key" ON "TestCasePrecondition"("testCaseId", "preconditionId");

-- CreateIndex
CREATE INDEX "TestCasePrecondition_testCaseId_idx" ON "TestCasePrecondition"("testCaseId");

-- CreateIndex
CREATE INDEX "TestCasePrecondition_preconditionId_idx" ON "TestCasePrecondition"("preconditionId");

-- AddForeignKey
ALTER TABLE "Precondition" ADD CONSTRAINT "Precondition_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreconditionStep" ADD CONSTRAINT "PreconditionStep_preconditionId_fkey" FOREIGN KEY ("preconditionId") REFERENCES "Precondition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCasePrecondition" ADD CONSTRAINT "TestCasePrecondition_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCasePrecondition" ADD CONSTRAINT "TestCasePrecondition_preconditionId_fkey" FOREIGN KEY ("preconditionId") REFERENCES "Precondition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
