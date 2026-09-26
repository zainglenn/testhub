import crypto from "node:crypto";
import {
  getJiraConfig,
  JIRA_ACCESSIBLE_RESOURCES_URL,
  JIRA_AUTH_URL,
  JIRA_SCOPES,
  JIRA_TOKEN_URL,
} from "./config";

export type JiraTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
};

export type JiraAccessibleResource = {
  id: string;
  url: string;
  name: string;
  scopes: string[];
  avatarUrl?: string;
};

export function createOAuthState(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function buildAuthorizeUrl(state: string): string {
  const { clientId, redirectUri } = getJiraConfig();
  const params = new URLSearchParams({
    audience: "api.atlassian.com",
    client_id: clientId,
    scope: JIRA_SCOPES.join(" "),
    redirect_uri: redirectUri,
    state,
    response_type: "code",
    prompt: "consent",
  });
  return `${JIRA_AUTH_URL}?${params.toString()}`;
}

async function requestTokens(body: Record<string, string>): Promise<JiraTokenResponse> {
  const response = await fetch(JIRA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Jira token request failed (${response.status}): ${detail}`);
  }

  return (await response.json()) as JiraTokenResponse;
}

export function exchangeCodeForTokens(code: string): Promise<JiraTokenResponse> {
  const { clientId, clientSecret, redirectUri } = getJiraConfig();
  return requestTokens({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });
}

export function refreshAccessToken(refreshToken: string): Promise<JiraTokenResponse> {
  const { clientId, clientSecret } = getJiraConfig();
  return requestTokens({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });
}

export async function fetchAccessibleResources(
  accessToken: string,
): Promise<JiraAccessibleResource[]> {
  const response = await fetch(JIRA_ACCESSIBLE_RESOURCES_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Failed to load accessible Jira resources (${response.status}): ${detail}`,
    );
  }

  return (await response.json()) as JiraAccessibleResource[];
}
