import { authenticatePanel } from "@/lib/jira/panel-auth";
import { latestByCase } from "@/lib/metrics";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const FUNCTIONS = ["testHubFailing", "testHubHasTests", "testHubUntested"] as const;

/**
 * Backs the Forge JQL functions: returns the issue keys for a named predicate.
 * `?projectKey=` scopes to a TestHub project; omit it to search all projects.
 */
export async function GET(request: Request) {
  const authError = authenticatePanel(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const name = (url.searchParams.get("name") ?? "").trim();
  if (!(FUNCTIONS as readonly string[]).includes(name)) {
    return Response.json(
      { error: `name must be one of: ${FUNCTIONS.join(", ")}.` },
      { status: 400 },
    );
  }

  const projectKey = (url.searchParams.get("projectKey") ?? "").trim();
  let projectId: string | null = null;
  if (projectKey) {
    const project = await prisma.project.findFirst({
      where: { OR: [{ key: projectKey }, { jiraProjectKey: projectKey }] },
      select: { id: true },
    });
    if (!project) return Response.json({ keys: [] });
    projectId = project.id;
  }

  const links = await prisma.jiraIssueLink.findMany({
    where: projectId ? { testCase: { projectId } } : {},
    select: { issueKey: true, testCaseId: true },
  });
  if (links.length === 0) return Response.json({ keys: [] });

  const caseIds = [...new Set(links.map((link) => link.testCaseId))];
  const executions = await prisma.testExecution.findMany({
    where: { testCaseId: { in: caseIds } },
    orderBy: { executedAt: "asc" },
    select: { testCaseId: true, status: true, executedAt: true },
  });
  const latest = latestByCase(executions);

  const casesByIssue = new Map<string, string[]>();
  for (const link of links) {
    const list = casesByIssue.get(link.issueKey) ?? [];
    list.push(link.testCaseId);
    casesByIssue.set(link.issueKey, list);
  }

  const keys: string[] = [];
  for (const [issueKey, linkedCaseIds] of casesByIssue) {
    const statuses = linkedCaseIds.map(
      (id) => latest.get(id)?.status ?? null,
    );
    const match =
      name === "testHubHasTests"
        ? true
        : name === "testHubFailing"
          ? statuses.some((status) => status === "FAIL")
          : statuses.every((status) => status === null);
    if (match) keys.push(issueKey);
  }

  return Response.json({ keys: keys.sort() });
}
