import { prisma } from "@/lib/prisma";

/** Extracts the Jira project key from an issue key (e.g. SCRUM-12 -> SCRUM). */
export function jiraProjectKeyFromIssue(issueKey: string): string | null {
  const match = /^([A-Z][A-Z0-9_]*)-(\d+)$/.exec(issueKey.trim().toUpperCase());
  return match ? match[1] : null;
}

/** Finds the TestHub project mapped to a Jira project key. */
export async function findProjectForJiraKey(jiraProjectKey: string) {
  return prisma.project.findFirst({
    where: { jiraProjectKey },
    orderBy: { createdAt: "asc" },
  });
}

/** Finds the TestHub project that owns a given Jira issue key. */
export async function resolveProjectForIssue(issueKey: string) {
  const jiraProjectKey = jiraProjectKeyFromIssue(issueKey);
  if (!jiraProjectKey) return null;
  return findProjectForJiraKey(jiraProjectKey);
}
