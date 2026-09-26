import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getJiraConfig } from "@/lib/jira/config";
import { buildAuthorizeUrl, createOAuthState } from "@/lib/jira/oauth";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = getJiraConfig();

  if (!config.configured) {
    return NextResponse.redirect(`${config.baseUrl}/?jira=unconfigured`);
  }

  const workspace = await getWorkspace();
  const state = createOAuthState();
  const cookieStore = await cookies();
  cookieStore.set("jira_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  cookieStore.set("jira_oauth_workspace", workspace.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(buildAuthorizeUrl(state));
}
