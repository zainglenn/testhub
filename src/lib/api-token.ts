import crypto from "node:crypto";

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateApiToken(): {
  token: string;
  hash: string;
  prefix: string;
} {
  const token = `th_${crypto.randomBytes(24).toString("base64url")}`;
  return { token, hash: hashToken(token), prefix: token.slice(0, 12) };
}
