import { describe, expect, it } from "vitest";
import { deriveStatusFromSteps, summarizeStepStatuses } from "./execution";

describe("deriveStatusFromSteps", () => {
  it("returns null when no steps are recorded", () => {
    expect(deriveStatusFromSteps([])).toBeNull();
  });

  it("passes when every step passes", () => {
    expect(deriveStatusFromSteps(["PASS", "PASS"])).toBe("PASS");
  });

  it("fails if any step fails", () => {
    expect(deriveStatusFromSteps(["PASS", "FAIL", "PASS"])).toBe("FAIL");
  });

  it("prefers fail over blocked", () => {
    expect(deriveStatusFromSteps(["BLOCKED", "FAIL"])).toBe("FAIL");
  });

  it("blocks when a step is blocked and none fail", () => {
    expect(deriveStatusFromSteps(["PASS", "BLOCKED"])).toBe("BLOCKED");
  });

  it("passes a mix of pass and skipped", () => {
    expect(deriveStatusFromSteps(["PASS", "SKIPPED"])).toBe("PASS");
  });

  it("is skipped when all steps are skipped", () => {
    expect(deriveStatusFromSteps(["SKIPPED", "SKIPPED"])).toBe("SKIPPED");
  });
});

describe("summarizeStepStatuses", () => {
  it("counts recognised statuses and ignores unknown ones", () => {
    expect(
      summarizeStepStatuses(["PASS", "FAIL", "FAIL", "BOGUS", "PASS"]),
    ).toEqual({ PASS: 2, FAIL: 2, BLOCKED: 0, SKIPPED: 0 });
  });
});
