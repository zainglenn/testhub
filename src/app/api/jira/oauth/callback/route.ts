import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getJiraConfig } from "@/lib/jira/config";
import {
  exchangeCodeForTokens,
  fetchAccessibleResources,
} from "@/lib/jira/oauth";
import { prisma } from "@/lib/prisma";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const config = getJiraConfig();
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("jira_oauth_state")?.value;
  const workspaceCookie = cookieStore.get("jira_oauth_workspace")?.value;
  cookieStore.delete("jira_oauth_state");
  cookieStore.delete("jira_oauth_workspace");

  const fail = (reason: string) =>
    NextResponse.redirect(
      `${config.baseUrl}/?jira=${encodeURIComponent(reason)}`,
    );

  const params = request.nextUrl.searchParams;
  const oauthError = params.get("error");
  const code = params.get("code");
  const state = params.get("state");

  if (oauthError) return fail(oauthError);
  if (!code || !state || !expectedState || state !== expectedState) {
    return fail("invalid-state");
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const resources = await fetchAccessibleResources(tokens.access_token);
    const resource = resources[0];

    if (!resource) {
      return fail("no-accessible-site");
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    const workspace = await getWorkspace().catch(() => null);
    const workspaceId = workspaceCookie ?? workspace?.id ?? null;

    if (workspaceId) {
      await prisma.jiraConnection.deleteMany({ where: { workspaceId } });
    }

    await prisma.jiraConnection.create({
      data: {
        workspaceId,
        cloudId: resource.id,
        siteUrl: resource.url,
        siteName: resource.name,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiresAt,
        scopes: tokens.scope,
      },
    });
  } catch {
    return fail("exchange-failed");
  }

  return NextResponse.redirect(`${config.baseUrl}/?jira=connected`);
}
