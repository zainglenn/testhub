import {
  getJiraConnectionForWorkspace,
  searchIssues,
  type JiraIssue,
} from "@/lib/jira/client";
import { isJiraEnabled } from "@/lib/jira/config";
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
  error: string | null;
};

/**
 * Builds a Requirement -> Tests -> Results -> Bugs view by running a JQL query
 * against the connected Jira site and joining the results with the test cases
 * that link to those issues.
 */
export async function buildTraceability(
  projectId: string,
  jql: string,
): Promise<Traceability | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, key: true, name: true, workspaceId: true },
  });
  if (!project) return null;

  const base = {
    project: { id: project.id, key: project.key, name: project.name },
    siteUrl: null as string | null,
    jql,
    requirements: [] as RequirementRow[],
    error: null as string | null,
  };

  if (!isJiraEnabled()) {
    return { ...base, error: "Jira is not enabled. Set JIRA_ENABLED and connect a site." };
  }

  const connection = project.workspaceId
    ? await getJiraConnectionForWorkspace(project.workspaceId).catch(() => null)
    : null;
  if (!connection) {
    return { ...base, error: "Connect Jira to load requirements." };
  }

  let issues: JiraIssue[] = [];
  try {
    issues = await searchIssues(jql, 50);
  } catch (error) {
    return {
      ...base,
      siteUrl: connection.siteUrl,
      error: error instanceof Error ? error.message : "Failed to query Jira.",
    };
  }

  const keys = issues.map((issue) => issue.key);
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

  const requirements: RequirementRow[] = issues.map((issue) => {
    const rows = byKey.get(issue.key) ?? [];
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
        if ((link.issueType ?? "").toLowerCase() === "bug" && link.issueKey !== issue.key) {
          bugs.add(link.issueKey);
        }
      }
    }

    return {
      key: issue.key,
      summary: issue.fields.summary ?? null,
      status: issue.fields.status?.name ?? null,
      issueType: issue.fields.issuetype?.name ?? null,
      url: `${connection.siteUrl}/browse/${issue.key}`,
      tests,
      passed,
      failed,
      untested,
      coverage,
      bugs: [...bugs],
    };
  });

  return { ...base, siteUrl: connection.siteUrl, requirements };
}
