import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { getIssue, issueLinkFields } from "@/lib/jira/client";
import { isJiraEnabled } from "@/lib/jira/config";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function secretMatches(provided: string | null): boolean {
  const expected = process.env.JIRA_WEBHOOK_SECRET;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function extractIssueKey(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const issue = (payload as { issue?: { key?: unknown } }).issue;
  return issue && typeof issue.key === "string" ? issue.key : null;
}

/**
 * Inbound Jira webhook. Configure a Jira Cloud webhook (issue created/updated)
 * pointing here with a shared secret passed as `?secret=` or the
 * `x-jira-webhook-secret` header. We then refresh the local link metadata.
 */
export async function POST(request: Request) {
  if (!isJiraEnabled()) {
    return new Response("Jira is not enabled", { status: 404 });
  }
  if (!process.env.JIRA_WEBHOOK_SECRET) {
    return new Response("Webhook secret is not configured", { status: 503 });
  }

  const url = new URL(request.url);
  const provided =
    request.headers.get("x-jira-webhook-secret") ??
    url.searchParams.get("secret");
  if (!secretMatches(provided)) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const issueKey = extractIssueKey(payload);
  if (!issueKey) {
    // Nothing we can act on (e.g. a non-issue event) — acknowledge it.
    return Response.json({ ok: true, ignored: true });
  }

  try {
    const links = await prisma.jiraIssueLink.findMany({
      where: { issueKey },
      select: {
        id: true,
        testCase: { select: { project: { select: { workspaceId: true } } } },
      },
    });

    const byWorkspace = new Map<string, string[]>();
    for (const link of links) {
      const workspaceId = link.testCase.project.workspaceId;
      if (!workspaceId) continue;
      const ids = byWorkspace.get(workspaceId) ?? [];
      ids.push(link.id);
      byWorkspace.set(workspaceId, ids);
    }

    for (const [workspaceId, ids] of byWorkspace) {
      try {
        const issue = await getIssue(issueKey, workspaceId);
        await prisma.jiraIssueLink.updateMany({
          where: { id: { in: ids } },
          data: issueLinkFields(issue),
        });
        revalidatePath("/");
      } catch {
        // Jira or the network may be unavailable for this workspace — the next
        // event will retry.
      }
    }
  } catch {
    // Ignore lookup failures and acknowledge so Atlassian does not retry storm.
  }

  return Response.json({ ok: true });
}
