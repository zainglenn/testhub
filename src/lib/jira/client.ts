import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/secret-box";
import { getWorkspace } from "@/lib/workspace";
import { JIRA_API_BASE } from "./config";
import { refreshAccessToken } from "./oauth";

const TOKEN_SKEW_MS = 60_000;

export type JiraConnectionRecord = {
  id: string;
  cloudId: string;
  siteUrl: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
};

export async function getJiraConnectionForWorkspace(workspaceId: string) {
  return prisma.jiraConnection.findFirst({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  });
}

/** Connection for the active workspace (session contexts). */
export async function getJiraConnection() {
  const workspace = await getWorkspace().catch(() => null);
  if (!workspace) {
    return prisma.jiraConnection.findFirst({ orderBy: { createdAt: "desc" } });
  }
  return getJiraConnectionForWorkspace(workspace.id);
}

export async function deleteJiraConnection() {
  const workspace = await getWorkspace().catch(() => null);
  if (!workspace) {
    await prisma.jiraConnection.deleteMany();
    return;
  }
  await prisma.jiraConnection.deleteMany({
    where: { workspaceId: workspace.id },
  });
}

/**
 * Returns a connection whose access token is guaranteed to be valid,
 * refreshing it against Atlassian when it is close to expiring. Pass a
 * `workspaceId` for background contexts (webhooks, the panel API); otherwise
 * the active workspace is used.
 */
export async function getFreshConnection(
  workspaceId?: string,
): Promise<JiraConnectionRecord> {
  const connection = workspaceId
    ? await getJiraConnectionForWorkspace(workspaceId)
    : await getJiraConnection();
  if (!connection) {
    throw new Error("Jira is not connected");
  }

  const accessToken = decryptSecret(connection.accessToken);
  const refreshToken = connection.refreshToken
    ? decryptSecret(connection.refreshToken)
    : null;

  const stillValid = connection.expiresAt.getTime() - Date.now() > TOKEN_SKEW_MS;
  if (stillValid || !refreshToken) {
    return { ...connection, accessToken, refreshToken };
  }

  const tokens = await refreshAccessToken(refreshToken);
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  const nextRefreshToken = tokens.refresh_token ?? refreshToken;

  const updated = await prisma.jiraConnection.update({
    where: { id: connection.id },
    data: {
      accessToken: encryptSecret(tokens.access_token),
      refreshToken: encryptSecret(nextRefreshToken),
      expiresAt,
      scopes: tokens.scope,
    },
  });

  return {
    ...updated,
    accessToken: tokens.access_token,
    refreshToken: nextRefreshToken,
  };
}

export async function jiraFetch<T>(
  path: string,
  init?: RequestInit,
  workspaceId?: string,
): Promise<T> {
  const connection = await getFreshConnection(workspaceId);
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${connection.accessToken}`);
  headers.set("Accept", "application/json");
  if (init?.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(
    `${JIRA_API_BASE}/${connection.cloudId}/rest/api/3${path}`,
    { ...init, headers, cache: "no-store" },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Jira API ${path} failed (${response.status}): ${detail.slice(0, 300)}`,
    );
  }

  return (await response.json()) as T;
}

export type JiraIssue = {
  id: string;
  key: string;
  fields: {
    summary?: string;
    status?: { name?: string };
    issuetype?: { name?: string };
    project?: { key?: string };
  };
};

type JiraSearchResponse = {
  issues?: JiraIssue[];
};

export async function searchIssues(
  jql: string,
  maxResults = 25,
  workspaceId?: string,
): Promise<JiraIssue[]> {
  const params = new URLSearchParams({
    jql,
    maxResults: String(maxResults),
    fields: "summary,status,issuetype,project",
  });

  try {
    const data = await jiraFetch<JiraSearchResponse>(
      `/search/jql?${params.toString()}`,
      undefined,
      workspaceId,
    );
    return data.issues ?? [];
  } catch (error) {
    // Older Jira Cloud sites do not expose /search/jql yet.
    if (error instanceof Error && /\((404|410)\)/.test(error.message)) {
      const data = await jiraFetch<JiraSearchResponse>(
        `/search?${params.toString()}`,
        undefined,
        workspaceId,
      );
      return data.issues ?? [];
    }
    throw error;
  }
}

export async function getIssue(
  issueKey: string,
  workspaceId?: string,
): Promise<JiraIssue> {
  const params = new URLSearchParams({
    fields: "summary,status,issuetype,project",
  });
  return jiraFetch<JiraIssue>(
    `/issue/${encodeURIComponent(issueKey)}?${params.toString()}`,
    undefined,
    workspaceId,
  );
}

/** Resolves a Jira project's numeric id from its key. */
export async function getProjectId(
  projectKey: string,
  workspaceId?: string,
): Promise<string | null> {
  try {
    const project = await jiraFetch<{ id?: string }>(
      `/project/${encodeURIComponent(projectKey)}`,
      undefined,
      workspaceId,
    );
    return project.id ?? null;
  } catch {
    return null;
  }
}

/** Lists the issue (work) types available in a Jira project. */
export async function getProjectIssueTypes(
  projectId: string,
  workspaceId?: string,
): Promise<{ id: string; name: string; subtask: boolean }[]> {
  try {
    const types = await jiraFetch<
      { id: string; name: string; subtask?: boolean }[]
    >(
      `/issuetype/project?projectId=${encodeURIComponent(projectId)}`,
      undefined,
      workspaceId,
    );
    return types.map((type) => ({
      id: type.id,
      name: type.name,
      subtask: Boolean(type.subtask),
    }));
  } catch {
    return [];
  }
}

export function issueLinkFields(issue: JiraIssue) {
  return {
    issueKey: issue.key,
    issueId: issue.id,
    summary: issue.fields.summary ?? null,
    issueType: issue.fields.issuetype?.name ?? null,
    status: issue.fields.status?.name ?? null,
    projectKey: issue.fields.project?.key ?? null,
  };
}

type AdfNode = { type: string; [key: string]: unknown };

/**
 * Jira REST v3 requires comment bodies in Atlassian Document Format. We only
 * need simple paragraphs, so build the minimal valid document.
 */
export function adfDocument(paragraphs: string[]): AdfNode {
  return {
    type: "doc",
    version: 1,
    content: paragraphs.map((text) => ({
      type: "paragraph",
      content: [{ type: "text", text }],
    })),
  };
}

export async function addComment(
  issueKey: string,
  paragraphs: string[],
  workspaceId?: string,
): Promise<void> {
  await jiraFetch(
    `/issue/${encodeURIComponent(issueKey)}/comment`,
    { method: "POST", body: JSON.stringify({ body: adfDocument(paragraphs) }) },
    workspaceId,
  );
}

export type CreatedIssue = { id: string; key: string };
export async function createIssue(
  input: {
    projectKey: string;
    issueType: string;
    summary: string;
    descriptionLines?: string[];
  },
  workspaceId?: string,
): Promise<CreatedIssue> {
  return jiraFetch<CreatedIssue>(
    "/issue",
    {
      method: "POST",
      body: JSON.stringify({
        fields: {
          project: { key: input.projectKey },
          issuetype: { name: input.issueType },
          summary: input.summary,
          ...(input.descriptionLines && input.descriptionLines.length > 0
            ? { description: adfDocument(input.descriptionLines) }
            : {}),
        },
      }),
    },
    workspaceId,
  );
}

export async function updateIssue(
  issueKey: string,
  input: { summary?: string; descriptionLines?: string[] },
  workspaceId?: string,
): Promise<void> {
  await jiraFetch(
    `/issue/${encodeURIComponent(issueKey)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        fields: {
          ...(input.summary ? { summary: input.summary } : {}),
          ...(input.descriptionLines
            ? { description: adfDocument(input.descriptionLines) }
            : {}),
        },
      }),
    },
    workspaceId,
  );
}

/**
 * Transitions an issue to the given target status, matching the issue's
 * available transitions by their destination status name. Returns false when no
 * such transition exists (workflows differ per project).
 */
export async function transitionIssue(
  issueKey: string,
  targetStatus: string,
  workspaceId?: string,
): Promise<boolean> {
  const data = await jiraFetch<{
    transitions?: { id: string; name: string; to?: { name?: string } }[];
  }>(`/issue/${encodeURIComponent(issueKey)}/transitions`, undefined, workspaceId);

  const wanted = targetStatus.trim().toLowerCase();
  if (!wanted) return false;

  const match = (data.transitions ?? []).find(
    (transition) =>
      (transition.to?.name ?? transition.name).trim().toLowerCase() === wanted,
  );
  if (!match) return false;

  await jiraFetch(
    `/issue/${encodeURIComponent(issueKey)}/transitions`,
    { method: "POST", body: JSON.stringify({ transition: { id: match.id } }) },
    workspaceId,
  );
  return true;
}
