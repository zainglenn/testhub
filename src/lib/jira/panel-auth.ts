import crypto from "node:crypto";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

function getPanelSecret(): string | null {
  const secret = process.env.JIRA_PANEL_SECRET;
  return secret && secret.length > 0 ? secret : null;
}

function base64urlToBuffer(value: string): Buffer {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Accepts either the raw shared secret or an HS256 JWT signed with it. A
 * companion Jira app (Forge/Connect) mints the token; the signature and `exp`
 * claim are both verified.
 */
export function verifyPanelToken(token: string): boolean {
  const secret = getPanelSecret();
  if (!secret) return false;

  if (safeEqual(Buffer.from(token), Buffer.from(secret))) return true;

  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [header, payload, signature] = parts;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest();
  if (!safeEqual(base64urlToBuffer(signature), expected)) return false;

  try {
    const claims = JSON.parse(base64urlToBuffer(payload).toString("utf8")) as {
      exp?: unknown;
    };
    if (typeof claims.exp === "number" && claims.exp * 1000 < Date.now()) {
      return false;
    }
  } catch {
    return false;
  }

  return true;
}

/** Returns a Response when the request is not authorised, otherwise null. */
export async function authenticatePanel(
  request: Request,
  name = "panel",
): Promise<Response | null> {
  if (!getPanelSecret()) {
    return Response.json(
      { error: "Panel API is not configured." },
      { status: 503 },
    );
  }

  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : (request.headers.get("x-jira-panel-token")?.trim() ?? "");

  if (!token || !verifyPanelToken(token)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const limit = await rateLimit({
    key: `panel:${name}`,
    limit: 240,
    windowMs: 60_000,
  });
  return rateLimitResponse(limit);
}
