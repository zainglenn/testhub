import { describe, expect, it } from "vitest";
import { generateApiToken, hashToken } from "./api-token";

describe("api tokens", () => {
  it("generates a prefixed token whose hash matches", () => {
    const { token, hash, prefix } = generateApiToken();
    expect(token.startsWith("th_")).toBe(true);
    expect(hash).toBe(hashToken(token));
    expect(hash).toHaveLength(64);
    expect(prefix).toBe(token.slice(0, 12));
  });

  it("generates unique tokens", () => {
    expect(generateApiToken().token).not.toBe(generateApiToken().token);
  });
});
