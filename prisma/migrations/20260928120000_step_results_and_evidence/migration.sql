-- CreateTable
CREATE TABLE "TestExecutionStep" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "testStepId" TEXT,
    "order" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestExecutionStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "executionStepId" TEXT,
    "filename" TEXT NOT NULL,
    "mime" TEXT,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TestExecutionStep_executionId_order_key" ON "TestExecutionStep"("executionId", "order");

-- CreateIndex
CREATE INDEX "TestExecutionStep_executionId_idx" ON "TestExecutionStep"("executionId");

-- CreateIndex
CREATE INDEX "TestExecutionStep_testStepId_idx" ON "TestExecutionStep"("testStepId");

-- CreateIndex
CREATE INDEX "Evidence_workspaceId_idx" ON "Evidence"("workspaceId");

-- CreateIndex
CREATE INDEX "Evidence_executionId_idx" ON "Evidence"("executionId");

-- CreateIndex
CREATE INDEX "Evidence_executionStepId_idx" ON "Evidence"("executionStepId");

-- AddForeignKey
ALTER TABLE "TestExecutionStep" ADD CONSTRAINT "TestExecutionStep_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "TestExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestExecutionStep" ADD CONSTRAINT "TestExecutionStep_testStepId_fkey" FOREIGN KEY ("testStepId") REFERENCES "TestStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "TestExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_executionStepId_fkey" FOREIGN KEY ("executionStepId") REFERENCES "TestExecutionStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
