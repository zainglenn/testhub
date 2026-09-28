import { authenticatePanel } from "@/lib/jira/panel-auth";
import { executionTrend, latestByCase, summarizeLatest } from "@/lib/metrics";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-jira-panel-token",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
} as const;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: CORS_HEADERS });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Metrics feed for the Jira dashboard gadget. `?projects=1` lists the mapped
 * projects (for the gadget's config); otherwise `?projectKey=`/`?projectId=`
 * returns pass-rate and coverage for one project.
 */
export async function GET(request: Request) {
  const authError = await authenticatePanel(request, "metrics");
  if (authError) return authError;

  const url = new URL(request.url);

  if (url.searchParams.get("projects")) {
    const projects = await prisma.project.findMany({
      where: { jiraProjectKey: { not: null } },
      orderBy: { name: "asc" },
      select: { id: true, key: true, name: true, jiraProjectKey: true },
    });
    return json({ projects });
  }

  const projectKey = (url.searchParams.get("projectKey") ?? "").trim();
  const projectId = (url.searchParams.get("projectId") ?? "").trim();

  const select = { id: true, key: true, name: true, jiraProjectKey: true } as const;
  const project = projectId
    ? await prisma.project.findFirst({ where: { id: projectId }, select })
    : projectKey
      ? await prisma.project.findFirst({
          where: { jiraProjectKey: projectKey.toUpperCase() },
          select,
        })
      : await prisma.project.findFirst({
          where: { jiraProjectKey: { not: null } },
          orderBy: { name: "asc" },
          select,
        });
  if (!project) {
    return json(
      { error: "No TestHub project is mapped to a Jira project yet." },
      404,
    );
  }

  const [caseCount, executions] = await Promise.all([
    prisma.testCase.count({ where: { projectId: project.id } }),
    prisma.testExecution.findMany({
      where: { projectId: project.id },
      orderBy: { executedAt: "asc" },
      select: { testCaseId: true, status: true, executedAt: true },
    }),
  ]);

  const summary = summarizeLatest(latestByCase(executions).values());
  const trend = executionTrend(executions);
  const coverage =
    caseCount > 0 ? Math.round((summary.passed / caseCount) * 100) : 0;
  const appBase = (process.env.APP_BASE_URL ?? "").replace(/\/$/, "");

  return json({
    project,
    reportsUrl: appBase
      ? `${appBase}/projects/${project.id}/reports`
      : null,
    totals: {
      cases: caseCount,
      executed: summary.total,
      passed: summary.passed,
      failed: summary.failed,
      untested: Math.max(caseCount - summary.total, 0),
    },
    breakdown: summary.breakdown,
    passRate: summary.passRate,
    coverage,
    trend,
    generatedAt: new Date().toISOString(),
  });
}
