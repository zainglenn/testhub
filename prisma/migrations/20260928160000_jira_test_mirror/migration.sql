-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "jiraTestIssueType" TEXT;

-- AlterTable
ALTER TABLE "TestCase" ADD COLUMN     "jiraIssueKey" TEXT;

-- CreateIndex
CREATE INDEX "TestCase_jiraIssueKey_idx" ON "TestCase"("jiraIssueKey");
