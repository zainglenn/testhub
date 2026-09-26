import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit";
import { encodeSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, SESSION_TTL_MS } from "@/lib/session";
import { appBaseUrl, discover, getSsoSettings } from "@/lib/sso";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

type UserInfo = {
  email?: string;
  name?: string;
  preferred_username?: string;
  sub?: string;
};

export async function GET(request: NextRequest) {
  const base = appBaseUrl();
  const fail = (reason: string) =>
    NextResponse.redirect(`${base}/login?sso=${encodeURIComponent(reason)}`);

  const config = await getSsoSettings();
  if (!config) return fail("unconfigured");

  const params = request.nextUrl.searchParams;
  if (params.get("error")) return fail(params.get("error")!);

  const code = params.get("code");
  const state = params.get("state");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("sso_state")?.value;
  const verifier = cookieStore.get("sso_verifier")?.value;
  cookieStore.delete("sso_state");
  cookieStore.delete("sso_verifier");

  if (!code || !state || !expectedState || state !== expectedState || !verifier) {
    return fail("state");
  }

  let endpoints;
  try {
    endpoints = await discover(config.issuerUrl!);
  } catch {
    return fail("discovery");
  }

  let accessToken: string | undefined;
  try {
    const response = await fetch(endpoints.token_endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${base}/api/sso/callback`,
        client_id: config.clientId!,
        client_secret: config.clientSecret!,
        code_verifier: verifier,
      }),
      cache: "no-store",
    });
    if (!response.ok) return fail("token");
    const tokens = (await response.json()) as { access_token?: string };
    accessToken = tokens.access_token;
  } catch {
    return fail("token");
  }

  if (!endpoints.userinfo_endpoint || !accessToken) {
    return fail("userinfo");
  }

  let profile: UserInfo;
  try {
    const response = await fetch(endpoints.userinfo_endpoint, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!response.ok) return fail("userinfo");
    profile = (await response.json()) as UserInfo;
  } catch {
    return fail("userinfo");
  }

  const email = (profile.email ?? "").trim().toLowerCase();
  if (!email) return fail("no-email");

  const name = (
    profile.name ||
    profile.preferred_username ||
    email.split("@")[0]
  ).toString();

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: `!sso-${crypto.randomUUID()}`,
        role: "MEMBER",
      },
    });
  }

  const workspace = await getWorkspace();
  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: { workspaceId: workspace.id, userId: user.id },
    },
    create: { workspaceId: workspace.id, userId: user.id },
    update: {},
  });

  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for");
  const sessionRecord = await prisma.session.create({
    data: {
      userId: user.id,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      userAgent: headerStore.get("user-agent")?.slice(0, 300) ?? null,
      ip: forwarded ? forwarded.split(",")[0].trim() : null,
    },
  });

  const token = encodeSession({
    sessionId: sessionRecord.id,
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });

  await recordAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    action: "auth.sso",
    entityType: "user",
    entityId: user.id,
  });

  return NextResponse.redirect(`${base}/projects`);
}
