import { getJiraConnectionForWorkspace } from "@/lib/jira/client";
import { authenticatePanel } from "@/lib/jira/panel-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-jira-panel-token",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
} as const;

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: CORS_HEADERS });
}

/**
 * Coverage feed for the embedded Jira issue panel: given a requirement/issue,
 * returns the linked tests, their latest result, linked bugs and recent runs.
 * Auth: `JIRA_PANEL_SECRET` (bearer token or HS256 JWT).
 */
export async function GET(request: Request) {
  const authError = await authenticatePanel(request, "coverage");
  if (authError) return authError;

  const url = new URL(request.url);
  const key = (url.searchParams.get("key") ?? "").trim();
  const issueId = (url.searchParams.get("issueId") ?? "").trim();
  if (!key && !issueId) {
    return json({ error: "Provide ?key=PROJ-123 or ?issueId=<id>." }, 400);
  }

  const anchor = await prisma.jiraIssueLink.findFirst({
    where: key ? { issueKey: key } : { issueId },
    select: {
      issueKey: true,
      issueId: true,
      summary: true,
      status: true,
      issueType: true,
      projectKey: true,
      url: true,
      testCase: { select: { project: { select: { workspaceId: true } } } },
    },
  });

  const workspaceId = anchor?.testCase.project.workspaceId ?? null;
  const connection = workspaceId
    ? await getJiraConnectionForWorkspace(workspaceId).catch(() => null)
    : null;
  const browseUrl = (issueKey: string) =>
    connection ? `${connection.siteUrl}/browse/${issueKey}` : null;
  const appBase = (process.env.APP_BASE_URL ?? "").replace(/\/$/, "");

  const issueKey = anchor?.issueKey ?? key;
  const issue = issueKey
    ? {
        issueKey,
        issueId: anchor?.issueId || issueId || null,
        summary: anchor?.summary ?? null,
        status: anchor?.status ?? null,
        issueType: anchor?.issueType ?? null,
        projectKey: anchor?.projectKey ?? null,
        url: anchor?.url ?? browseUrl(issueKey),
      }
    : null;

  const links = issueKey
    ? await prisma.jiraIssueLink.findMany({
        where: {
          issueKey,
          ...(workspaceId
            ? { testCase: { project: { workspaceId } } }
            : {}),
        },
        select: { testCaseId: true },
      })
    : [];
  const caseIds = [...new Set(links.map((link) => link.testCaseId))];

  if (caseIds.length === 0) {
    return json({
      issue,
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        blocked: 0,
        skipped: 0,
        untested: 0,
        coverage: 0,
      },
      tests: [],
      linkedBugs: [],
      recentRuns: [],
      generatedAt: new Date().toISOString(),
    });
  }

  const cases = await prisma.testCase.findMany({
    where: { id: { in: caseIds } },
    select: {
      id: true,
      number: true,
      title: true,
      project: { select: { id: true, key: true, name: true } },
      suite: { select: { id: true, name: true } },
      jiraLinks: {
        select: { issueKey: true, issueType: true, summary: true, status: true },
      },
      steps: {
        orderBy: { order: "asc" },
        select: { order: true, action: true, expectedResult: true },
      },
      executions: {
        orderBy: { executedAt: "desc" },
        take: 1,
        select: { status: true, executedAt: true, runId: true },
      },
    },
  });

  const tests = cases.map((testCase) => {
    const latest = testCase.executions[0] ?? null;
    return {
      id: testCase.id,
      key: `${testCase.project.key}-${testCase.number}`,
      title: testCase.title,
      status: latest?.status ?? "UNTESTED",
      lastExecutedAt: latest?.executedAt ?? null,
      runId: latest?.runId ?? null,
      project: testCase.project,
      suite: testCase.suite,
      steps: testCase.steps.map((step, index) => ({
        order: index + 1,
        action: step.action,
        expectedResult: step.expectedResult,
      })),
      url: appBase
        ? `${appBase}/projects/${testCase.project.id}/cases?case=${testCase.id}`
        : null,
    };
  });

  const counts = { passed: 0, failed: 0, blocked: 0, skipped: 0, untested: 0 };
  for (const test of tests) {
    switch (test.status) {
      case "PASS":
        counts.passed++;
        break;
      case "FAIL":
        counts.failed++;
        break;
      case "BLOCKED":
        counts.blocked++;
        break;
      case "SKIPPED":
        counts.skipped++;
        break;
      default:
        counts.untested++;
    }
  }
  const total = tests.length;
  const coverage = total > 0 ? Math.round((counts.passed / total) * 100) : 0;

  const runItems = await prisma.testRunItem.findMany({
    where: { testCaseId: { in: caseIds } },
    select: {
      run: {
        select: {
          id: true,
          name: true,
          status: true,
          environment: true,
          completedAt: true,
          createdAt: true,
        },
      },
    },
  });
  const runMap = new Map<string, (typeof runItems)[number]["run"]>();
  for (const item of runItems) runMap.set(item.run.id, item.run);
  const recentRuns = [...runMap.values()]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5);

  const bugMap = new Map<
    string,
    {
      issueKey: string;
      summary: string | null;
      status: string | null;
      url: string | null;
    }
  >();
  for (const testCase of cases) {
    for (const link of testCase.jiraLinks) {
      if (
        (link.issueType ?? "").toLowerCase() === "bug" &&
        link.issueKey !== issueKey
      ) {
        if (!bugMap.has(link.issueKey)) {
          bugMap.set(link.issueKey, {
            issueKey: link.issueKey,
            summary: link.summary,
            status: link.status,
            url: browseUrl(link.issueKey),
          });
        }
      }
    }
  }

  return json({
    issue,
    summary: { total, ...counts, coverage },
    tests,
    linkedBugs: [...bugMap.values()],
    recentRuns,
    generatedAt: new Date().toISOString(),
  });
}
