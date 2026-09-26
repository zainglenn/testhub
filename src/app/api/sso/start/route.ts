import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { appBaseUrl, base64url, discover, getSsoSettings } from "@/lib/sso";

export const dynamic = "force-dynamic";

export async function GET() {
  const base = appBaseUrl();
  const config = await getSsoSettings();
  if (!config) {
    return NextResponse.redirect(`${base}/login?sso=unconfigured`);
  }

  let endpoints;
  try {
    endpoints = await discover(config.issuerUrl!);
  } catch {
    return NextResponse.redirect(`${base}/login?sso=discovery`);
  }

  const state = crypto.randomBytes(16).toString("hex");
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(
    crypto.createHash("sha256").update(verifier).digest(),
  );
  const nonce = crypto.randomBytes(16).toString("hex");

  const cookieStore = await cookies();
  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  };
  cookieStore.set("sso_state", state, options);
  cookieStore.set("sso_verifier", verifier, options);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId!,
    redirect_uri: `${base}/api/sso/callback`,
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  return NextResponse.redirect(
    `${endpoints.authorization_endpoint}?${params.toString()}`,
  );
}
