import crypto from "node:crypto";

export const SESSION_COOKIE = "testhub_session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

const DEV_SECRET = "testhub-dev-secret-change-me-in-production";

let cachedSecret: string | null = null;

function getSecret(): string {
  if (cachedSecret) return cachedSecret;
  const secret = process.env.AUTH_SECRET;
  if (process.env.NODE_ENV === "production" && !secret) {
    throw new Error("AUTH_SECRET must be set in production.");
  }
  cachedSecret = secret ?? DEV_SECRET;
  return cachedSecret;
}

export type Session = {
  sessionId: string;
  userId: string;
  email: string;
  name: string;
  role: string;
  exp: number;
};

type SessionInput = {
  sessionId: string;
  userId: string;
  email: string;
  name: string;
  role: string;
};

function sign(payload: string): string {
  return crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest("base64url");
}

export function encodeSession(input: SessionInput): string {
  const session: Session = {
    sessionId: input.sessionId,
    userId: input.userId,
    email: input.email,
    name: input.name,
    role: input.role,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString(
    "base64url",
  );
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(raw: string | undefined): Session | null {
  if (!raw) return null;

  const [payload, signature] = raw.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const provided = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    provided.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(provided, expectedBuffer)
  ) {
    return null;
  }

  try {
    const data = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Partial<Session>;

    if (typeof data.userId !== "string" || data.userId.length === 0) return null;
    if (typeof data.sessionId !== "string" || data.sessionId.length === 0) {
      return null;
    }
    if (typeof data.email !== "string" || data.email.length === 0) return null;
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null;

    return {
      sessionId: data.sessionId,
      userId: data.userId,
      email: data.email,
      name:
        typeof data.name === "string" && data.name.length > 0
          ? data.name
          : data.email,
      role: typeof data.role === "string" ? data.role : "MEMBER",
      exp: data.exp,
    };
  } catch {
    return null;
  }
}

export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/projects";
  }
  return next;
}
