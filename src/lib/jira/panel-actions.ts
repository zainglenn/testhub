import { isExecutionStatus } from "@/lib/constants";
import { getIssue, issueLinkFields } from "@/lib/jira/client";
import { commentCaseResult } from "@/lib/jira/sync";
import { resolveProjectForIssue } from "@/lib/jira/panel-project";
import { prisma } from "@/lib/prisma";

const MAX_TESTS = 50;

function appBase(): string {
  return (process.env.APP_BASE_URL ?? "").replace(/\/$/, "");
}

function caseUrl(projectId: string, caseId: string): string | null {
  const base = appBase();
  return base ? `${base}/projects/${projectId}/cases?case=${caseId}` : null;
}

type ProjectRecord = NonNullable<Awaited<ReturnType<typeof resolveProjectForIssue>>>;

async function upsertLink(
  testCaseId: string,
  issueKey: string,
  workspaceId: string | null,
) {
  let fields: {
    issueKey: string;
    issueId: string | null;
    summary: string | null;
    issueType: string | null;
    status: string | null;
    projectKey: string | null;
  } = {
    issueKey,
    issueId: null,
    summary: null,
    issueType: null,
    status: null,
    projectKey: null,
  };
  try {
    const issue = await getIssue(issueKey, workspaceId ?? undefined);
    fields = { ...issueLinkFields(issue) };
  } catch {
    // Jira metadata is best-effort; the link still works without it.
  }
  await prisma.jiraIssueLink.upsert({
    where: { testCaseId_issueKey: { testCaseId, issueKey } },
    create: { testCaseId, ...fields },
    update: fields,
  });
}

async function resolveCase(
  project: ProjectRecord,
  caseKeyOrId: string,
): Promise<{ id: string; number: number; title: string } | null> {
  const selector = caseKeyOrId.trim();
  if (!selector) return null;

  const byId = await prisma.testCase.findFirst({
    where: { id: selector, projectId: project.id },
    select: { id: true, number: true, title: true },
  });
  if (byId) return byId;

  const match = new RegExp(`^${project.key}-(\\d+)$`, "i").exec(selector);
  if (match) {
    return prisma.testCase.findFirst({
      where: { projectId: project.id, number: Number(match[1]) },
      select: { id: true, number: true, title: true },
    });
  }
  return null;
}

function testSummary(
  project: ProjectRecord,
  testCase: { id: string; number: number; title: string; status?: string },
  latestStatus: string | null,
) {
  return {
    id: testCase.id,
    key: `${project.key}-${testCase.number}`,
    title: testCase.title,
    status: latestStatus ?? "UNTESTED",
    url: caseUrl(project.id, testCase.id),
  };
}

export async function listTests(input: {
  issueKey: string;
  query?: string;
  limit?: number;
}) {
  const project = await resolveProjectForIssue(input.issueKey);
  if (!project) {
    return { error: `No TestHub project is mapped to ${input.issueKey}.` };
  }

  const cases = await prisma.testCase.findMany({
    where: {
      projectId: project.id,
      ...(input.query
        ? { title: { contains: input.query, mode: "insensitive" as const } }
        : {}),
    },
    orderBy: { number: "asc" },
    take: Math.min(input.limit ?? 25, MAX_TESTS),
    select: {
      id: true,
      number: true,
      title: true,
      executions: {
        orderBy: { executedAt: "desc" },
        take: 1,
        select: { status: true },
      },
    },
  });

  return {
    project: { id: project.id, key: project.key, name: project.name },
    tests: cases.map((testCase) =>
      testSummary(project, testCase, testCase.executions[0]?.status ?? null),
    ),
  };
}

export async function createTest(input: {
  issueKey: string;
  title: string;
  description?: string;
  steps?: { action: string; expectedResult?: string }[];
}) {
  const project = await resolveProjectForIssue(input.issueKey);
  if (!project) {
    return { error: `No TestHub project is mapped to ${input.issueKey}.` };
  }
  const title = input.title?.trim();
  if (!title) return { error: "A title is required." };

  const last = await prisma.testCase.aggregate({
    where: { projectId: project.id },
    _max: { number: true },
  });
  const number = (last._max.number ?? 0) + 1;

  const steps = (input.steps ?? [])
    .map((step) => ({
      action: step.action?.trim() ?? "",
      expectedResult: step.expectedResult?.trim() || null,
    }))
    .filter((step) => step.action.length > 0);

  const testCase = await prisma.testCase.create({
    data: {
      projectId: project.id,
      number,
      title: title.slice(0, 300),
      description: input.description?.trim() || null,
      status: "ACTIVE",
      steps: {
        create: steps.map((step, index) => ({
          order: index,
          action: step.action.slice(0, 2000),
          expectedResult: step.expectedResult,
        })),
      },
    },
    select: { id: true, number: true, title: true },
  });

  await upsertLink(testCase.id, input.issueKey, project.workspaceId);

  return { test: testSummary(project, testCase, null) };
}

export async function linkTest(input: { issueKey: string; caseKey: string }) {
  const project = await resolveProjectForIssue(input.issueKey);
  if (!project) {
    return { error: `No TestHub project is mapped to ${input.issueKey}.` };
  }
  const testCase = await resolveCase(project, input.caseKey ?? "");
  if (!testCase) {
    return { error: `Test "${input.caseKey}" was not found.` };
  }

  await upsertLink(testCase.id, input.issueKey, project.workspaceId);
  return { test: testSummary(project, testCase, null) };
}

export async function recordTestResult(input: {
  issueKey: string;
  caseKey: string;
  status: string;
  comment?: string;
}) {
  const project = await resolveProjectForIssue(input.issueKey);
  if (!project) {
    return { error: `No TestHub project is mapped to ${input.issueKey}.` };
  }
  if (!isExecutionStatus(input.status)) {
    return { error: "Invalid result status." };
  }
  const testCase = await resolveCase(project, input.caseKey ?? "");
  if (!testCase) {
    return { error: `Test "${input.caseKey}" was not found.` };
  }

  await prisma.testExecution.create({
    data: {
      testCaseId: testCase.id,
      projectId: project.id,
      status: input.status,
      comment: input.comment?.trim() || null,
    },
  });

  await commentCaseResult(testCase.id, input.status, "Recorded from Jira");

  return { test: testSummary(project, testCase, input.status) };
}
