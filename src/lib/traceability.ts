import {
  getJiraConnectionForWorkspace,
  searchIssues,
} from "@/lib/jira/client";
import { prisma } from "@/lib/prisma";

export const DEFAULT_REQUIREMENTS_JQL =
  "issuetype in (Epic, Story) ORDER BY created ASC";

export type TraceabilityTest = {
  id: string;
  key: string;
  title: string;
  status: string;
};

export type RequirementRow = {
  key: string;
  summary: string | null;
  status: string | null;
  issueType: string | null;
  url: string | null;
  tests: TraceabilityTest[];
  passed: number;
  failed: number;
  untested: number;
  coverage: number;
  bugs: string[];
};

export type Traceability = {
  project: { id: string; key: string; name: string };
  siteUrl: string | null;
  jql: string;
  requirements: RequirementRow[];
  storedCount: number;
};

/** Pulls requirements from Jira for a JQL query and upserts them locally. */
export async function syncProjectRequirements(
  projectId: string,
  jql: string,
): Promise<{ count: number; error: string | null }> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, workspaceId: true },
  });
  if (!project) return { count: 0, error: "Project not found." };

  const connection = project.workspaceId
    ? await getJiraConnectionForWorkspace(project.workspaceId).catch(() => null)
    : null;
  if (!connection) {
    return { count: 0, error: "Connect Jira to sync requirements." };
  }

  let issues;
  try {
    issues = await searchIssues(jql, 50);
  } catch (error) {
    return {
      count: 0,
      error: error instanceof Error ? error.message : "Failed to query Jira.",
    };
  }

  let count = 0;
  for (const issue of issues) {
    const data = {
      summary: issue.fields.summary ?? null,
      status: issue.fields.status?.name ?? null,
      issueType: issue.fields.issuetype?.name ?? null,
      url: `${connection.siteUrl}/browse/${issue.key}`,
    };
    await prisma.requirement.upsert({
      where: { projectId_issueKey: { projectId, issueKey: issue.key } },
      create: { projectId, issueKey: issue.key, ...data },
      update: data,
    });
    count += 1;
  }

  await prisma.project.update({
    where: { id: projectId },
    data: { requirementJql: jql },
  });

  return { count, error: null };
}

/** Builds the Requirement -> Tests -> Results -> Bugs matrix from stored data. */
export async function buildTraceability(
  projectId: string,
): Promise<Traceability | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      key: true,
      name: true,
      workspaceId: true,
      requirementJql: true,
    },
  });
  if (!project) return null;

  const connection = project.workspaceId
    ? await getJiraConnectionForWorkspace(project.workspaceId).catch(() => null)
    : null;

  const stored = await prisma.requirement.findMany({
    where: { projectId },
    orderBy: { issueKey: "asc" },
  });
  const keys = stored.map((requirement) => requirement.issueKey);

  const links = keys.length
    ? await prisma.jiraIssueLink.findMany({
        where: { issueKey: { in: keys }, testCase: { projectId } },
        select: {
          issueKey: true,
          testCase: {
            select: {
              id: true,
              number: true,
              title: true,
              project: { select: { key: true } },
              executions: {
                orderBy: { executedAt: "desc" },
                take: 1,
                select: { status: true },
              },
              jiraLinks: { select: { issueKey: true, issueType: true } },
            },
          },
        },
      })
    : [];

  const byKey = new Map<string, typeof links>();
  for (const link of links) {
    const list = byKey.get(link.issueKey) ?? [];
    list.push(link);
    byKey.set(link.issueKey, list);
  }

  const requirements: RequirementRow[] = stored.map((requirement) => {
    const rows = byKey.get(requirement.issueKey) ?? [];
    const tests: TraceabilityTest[] = rows.map((row) => ({
      id: row.testCase.id,
      key: `${row.testCase.project.key}-${row.testCase.number}`,
      title: row.testCase.title,
      status: row.testCase.executions[0]?.status ?? "UNTESTED",
    }));

    const passed = tests.filter((test) => test.status === "PASS").length;
    const failed = tests.filter((test) => test.status === "FAIL").length;
    const untested = tests.filter((test) => test.status === "UNTESTED").length;
    const coverage = tests.length
      ? Math.round((passed / tests.length) * 100)
      : 0;

    const bugs = new Set<string>();
    for (const row of rows) {
      for (const link of row.testCase.jiraLinks) {
        if (
          (link.issueType ?? "").toLowerCase() === "bug" &&
          link.issueKey !== requirement.issueKey
        ) {
          bugs.add(link.issueKey);
        }
      }
    }

    return {
      key: requirement.issueKey,
      summary: requirement.summary,
      status: requirement.status,
      issueType: requirement.issueType,
      url: requirement.url,
      tests,
      passed,
      failed,
      untested,
      coverage,
      bugs: [...bugs],
    };
  });

  return {
    project: { id: project.id, key: project.key, name: project.name },
    siteUrl: connection?.siteUrl ?? null,
    jql: project.requirementJql ?? DEFAULT_REQUIREMENTS_JQL,
    requirements,
    storedCount: stored.length,
  };
}
