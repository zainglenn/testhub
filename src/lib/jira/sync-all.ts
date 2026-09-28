import {
  getIssue,
  issueLinkFields,
} from "@/lib/jira/client";
import { prisma } from "@/lib/prisma";
import { syncProjectRequirements } from "@/lib/traceability";

const LINK_LIMIT = 200;

/**
 * Refreshes cached Jira metadata (summary/status) for every linked issue, per
 * workspace. Best-effort: a failing issue is skipped rather than aborting.
 */
export async function refreshJiraLinks(): Promise<{
  updated: number;
  failed: number;
}> {
  const connections = await prisma.jiraConnection.findMany({
    select: { workspaceId: true },
  });
  const workspaceIds = Array.from(
    new Set(
      connections
        .map((connection) => connection.workspaceId)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  let updated = 0;
  let failed = 0;

  for (const workspaceId of workspaceIds) {
    const links = await prisma.jiraIssueLink.findMany({
      where: { testCase: { project: { workspaceId } } },
      select: { issueKey: true },
      take: LINK_LIMIT,
    });
    const issueKeys = Array.from(new Set(links.map((link) => link.issueKey)));

    for (const issueKey of issueKeys) {
      try {
        const issue = await getIssue(issueKey, workspaceId);
        const result = await prisma.jiraIssueLink.updateMany({
          where: { issueKey, testCase: { project: { workspaceId } } },
          data: issueLinkFields(issue),
        });
        updated += result.count;
      } catch {
        failed += 1;
      }
    }
  }

  return { updated, failed };
}

/** Re-syncs stored requirements for every project that has a saved JQL query. */
export async function syncAllRequirements(): Promise<{
  synced: number;
  failed: number;
}> {
  const projects = await prisma.project.findMany({
    where: { requirementJql: { not: null } },
    select: { id: true, requirementJql: true },
  });

  let synced = 0;
  let failed = 0;
  for (const project of projects) {
    const result = await syncProjectRequirements(
      project.id,
      project.requirementJql ?? "",
    );
    if (result.error) failed += 1;
    else synced += result.count;
  }
  return { synced, failed };
}

export async function runJiraSync() {
  const [links, requirements] = await Promise.all([
    refreshJiraLinks(),
    syncAllRequirements(),
  ]);
  return { links, requirements };
}
