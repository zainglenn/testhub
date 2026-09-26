import crypto from "node:crypto";

const PREFIX = "enc:v1:";
const KDF_SALT = "testhub-secret-box-v1";
const DEV_KEY = "testhub-dev-encryption-key-change-me";

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.ENCRYPTION_KEY ?? process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "ENCRYPTION_KEY (or AUTH_SECRET) must be set to encrypt secrets.",
      );
    }
    cachedKey = crypto.scryptSync(DEV_KEY, KDF_SALT, 32);
    return cachedKey;
  }
  cachedKey = crypto.scryptSync(secret, KDF_SALT, 32);
  return cachedKey;
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

/** AES-256-GCM. Output: `enc:v1:<iv>.<tag>.<ciphertext>` (base64url). */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const data = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${data.toString("base64url")}`;
}

/**
 * Decrypts a value produced by {@link encryptSecret}. Plaintext values (no
 * prefix) are returned unchanged so existing data keeps working until it is
 * re-encrypted.
 */
export function decryptSecret(value: string): string {
  if (!isEncrypted(value)) return value;

  const [ivPart, tagPart, dataPart] = value.slice(PREFIX.length).split(".");
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error("Malformed encrypted value.");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  const data = Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]);
  return data.toString("utf8");
}

export function encryptNullable(
  value: string | null | undefined,
): string | null {
  return value ? encryptSecret(value) : (value ?? null);
}

export function decryptNullable(
  value: string | null | undefined,
): string | null {
  return value ? decryptSecret(value) : (value ?? null);
}
