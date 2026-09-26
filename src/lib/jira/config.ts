export const JIRA_SCOPES = [
  "read:jira-work",
  "read:jira-user",
  "write:jira-work",
  "offline_access",
] as const;

export type JiraConfig = {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  redirectUri: string;
  configured: boolean;
};

export function getJiraConfig(): JiraConfig {
  const clientId = process.env.JIRA_CLIENT_ID ?? "";
  const clientSecret = process.env.JIRA_CLIENT_SECRET ?? "";
  const baseUrl = (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );

  return {
    clientId,
    clientSecret,
    baseUrl,
    redirectUri: `${baseUrl}/api/jira/oauth/callback`,
    configured: Boolean(clientId && clientSecret),
  };
}

/**
 * Jira integration is opt-in. It is disabled unless explicitly enabled via
 * `JIRA_ENABLED=true` (or credentials are present), so the app works fully
 * standalone without Jira.
 */
export function isJiraEnabled(): boolean {
  return process.env.JIRA_ENABLED === "true" || getJiraConfig().configured;
}

export const JIRA_AUTH_URL = "https://auth.atlassian.com/authorize";
export const JIRA_TOKEN_URL = "https://auth.atlassian.com/oauth/token";
export const JIRA_ACCESSIBLE_RESOURCES_URL =
  "https://api.atlassian.com/oauth/token/accessible-resources";
export const JIRA_API_BASE = "https://api.atlassian.com/ex/jira";
