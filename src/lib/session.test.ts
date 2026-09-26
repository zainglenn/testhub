import { describe, expect, it } from "vitest";
import { decodeSession, encodeSession, safeNextPath } from "./session";

describe("session encode/decode", () => {
  it("round-trips a session", () => {
    const token = encodeSession({
      sessionId: "sess_1",
      userId: "user_1",
      email: "a@b.com",
      name: "a",
      role: "ADMIN",
    });
    const session = decodeSession(token);

    expect(session?.userId).toBe("user_1");
    expect(session?.sessionId).toBe("sess_1");
    expect(session?.email).toBe("a@b.com");
    expect(session?.name).toBe("a");
    expect(session?.role).toBe("ADMIN");
    expect(session?.exp).toBeGreaterThan(Date.now());
  });

  it("rejects tampered or malformed tokens", () => {
    const token = encodeSession({
      sessionId: "sess_1",
      userId: "user_1",
      email: "a@b.com",
      name: "a",
      role: "ADMIN",
    });
    expect(decodeSession(`${token}x`)).toBeNull();
    expect(decodeSession("not-a-token")).toBeNull();
    expect(decodeSession(undefined)).toBeNull();
  });

  it("rejects an unsigned payload with a valid shape", () => {
    const payload = Buffer.from(
      JSON.stringify({
        userId: "user_1",
        email: "x@y.com",
        name: "x",
        exp: Date.now() + 1000,
      }),
    ).toString("base64url");

    expect(decodeSession(payload)).toBeNull();
  });
});

describe("safeNextPath", () => {
  it("allows internal paths", () => {
    expect(safeNextPath("/projects/1/cases")).toBe("/projects/1/cases");
  });

  it("defaults when empty", () => {
    expect(safeNextPath(null)).toBe("/projects");
    expect(safeNextPath(undefined)).toBe("/projects");
  });

  it("rejects protocol-relative and external URLs", () => {
    expect(safeNextPath("//evil.com")).toBe("/projects");
    expect(safeNextPath("https://evil.com")).toBe("/projects");
  });
});
