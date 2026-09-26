import { describe, expect, it } from "vitest";
import {
  executionInput,
  firstError,
  formToObject,
  projectInput,
  runInput,
  tagInput,
  testCaseInput,
} from "./validation";

describe("projectInput", () => {
  it("accepts a valid project and nulls empty description", () => {
    const result = projectInput.safeParse({
      key: "SHOP",
      name: "Shop",
      description: "",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.description).toBeNull();
  });

  it("rejects lowercase keys", () => {
    expect(projectInput.safeParse({ key: "shop", name: "Shop" }).success).toBe(
      false,
    );
  });

  it("rejects too-short keys", () => {
    expect(projectInput.safeParse({ key: "S", name: "Shop" }).success).toBe(
      false,
    );
  });

  it("trims values and nulls whitespace-only optional text", () => {
    const result = projectInput.safeParse({
      key: "SHOP",
      name: "  Shop  ",
      description: "   ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Shop");
      expect(result.data.description).toBeNull();
    }
  });
});

describe("testCaseInput", () => {
  it("defaults priority to MEDIUM", () => {
    const result = testCaseInput.safeParse({ projectId: "p1", title: "Case" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.priority).toBe("MEDIUM");
  });

  it("rejects blank titles", () => {
    expect(
      testCaseInput.safeParse({ projectId: "p1", title: "   " }).success,
    ).toBe(false);
  });
});

describe("runInput / tagInput / executionInput", () => {
  it("requires a run name", () => {
    expect(runInput.safeParse({ projectId: "p1", name: " " }).success).toBe(
      false,
    );
  });

  it("defaults run scope to ALL", () => {
    const result = runInput.safeParse({ projectId: "p1", name: "Run" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.scope).toBe("ALL");
  });

  it("requires a tag name", () => {
    expect(tagInput.safeParse({ testCaseId: "c1", name: "" }).success).toBe(
      false,
    );
  });

  it("defaults execution status to PASS", () => {
    const result = executionInput.safeParse({ testCaseId: "c1" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("PASS");
  });
});

describe("formToObject / firstError", () => {
  it("collects string fields", () => {
    const formData = new FormData();
    formData.set("a", "1");
    formData.set("b", "two");
    expect(formToObject(formData)).toEqual({ a: "1", b: "two" });
  });

  it("returns the first zod message", () => {
    const result = projectInput.safeParse({ key: "s", name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(firstError(result.error).length).toBeGreaterThan(0);
    }
  });
});
