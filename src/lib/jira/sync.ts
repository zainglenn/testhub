import { addComment, getJiraConnectionForWorkspace } from "@/lib/jira/client";
import { isJiraEnabled } from "@/lib/jira/config";
import { prisma } from "@/lib/prisma";

const STATUS_LABEL: Record<string, string> = {
  PASSED: "passed",
  FAILED: "failed",
  BLOCKED: "blocked",
  SKIPPED: "skipped",
  UNTESTED: "untested",
};

function labelFor(status: string): string {
  return STATUS_LABEL[status] ?? status.toLowerCase();
}

async function hasConnection(workspaceId: string | null): Promise<boolean> {
  if (!isJiraEnabled() || !workspaceId) return false;
  return Boolean(await getJiraConnectionForWorkspace(workspaceId).catch(() => null));
}

/**
 * Posts a result comment to every Jira issue linked to a test case.
 * Best-effort: Jira problems never fail the caller's action.
 */
export async function commentCaseResult(
  testCaseId: string,
  status: string,
  context?: string,
): Promise<void> {
  try {
    const testCase = await prisma.testCase.findUnique({
      where: { id: testCaseId },
      select: { project: { select: { workspaceId: true } } },
    });
    const workspaceId = testCase?.project.workspaceId ?? null;
    if (!(await hasConnection(workspaceId))) return;

    const links = await prisma.jiraIssueLink.findMany({
      where: { testCaseId },
      select: { issueKey: true },
    });
    if (links.length === 0) return;

    const line = context
      ? `${context}: result recorded as ${labelFor(status)}.`
      : `Result recorded as ${labelFor(status)}.`;

    await Promise.allSettled(
      links.map((link) =>
        addComment(link.issueKey, ["TestHub update", line], workspaceId ?? undefined),
      ),
    );
  } catch {
    // Swallow — outbound sync must not break the primary action.
  }
}

/**
 * Posts a single summary comment to every Jira issue linked to a run's cases
 * when the run is completed.
 */
export async function commentRunSummary(runId: string): Promise<void> {
  try {
    const run = await prisma.testRun.findUnique({
      where: { id: runId },
      select: { name: true, project: { select: { workspaceId: true } } },
    });
    if (!run) return;

    const workspaceId = run.project.workspaceId ?? null;
    if (!(await hasConnection(workspaceId))) return;

    const items = await prisma.testRunItem.findMany({
      where: { runId },
      select: {
        testCase: { select: { jiraLinks: { select: { issueKey: true } } } },
      },
    });

    const issueKeys = new Set<string>();
    for (const item of items) {
      for (const link of item.testCase.jiraLinks) issueKeys.add(link.issueKey);
    }
    if (issueKeys.size === 0) return;

    const executions = await prisma.testExecution.findMany({
      where: { runId },
      select: { status: true },
    });
    const counts = new Map<string, number>();
    for (const execution of executions) {
      counts.set(execution.status, (counts.get(execution.status) ?? 0) + 1);
    }
    const breakdown =
      [...counts.entries()]
        .map(([status, count]) => `${count} ${labelFor(status)}`)
        .join(", ") || "no results";

    const line = `Run "${run.name}" completed: ${breakdown}.`;

    await Promise.allSettled(
      [...issueKeys].map((key) =>
        addComment(key, ["TestHub run summary", line], workspaceId ?? undefined),
      ),
    );
  } catch {
    // Swallow — outbound sync must not break the primary action.
  }
}
