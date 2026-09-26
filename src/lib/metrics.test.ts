import { describe, expect, it } from "vitest";
import { executionTrend, latestByCase, summarizeLatest } from "./metrics";

const at = (iso: string) => new Date(iso);

describe("latestByCase", () => {
  it("keeps the most recent execution per case", () => {
    const map = latestByCase([
      { testCaseId: "a", status: "FAIL", executedAt: at("2026-01-01T00:00:00Z") },
      { testCaseId: "a", status: "PASS", executedAt: at("2026-01-02T00:00:00Z") },
      {
        testCaseId: "b",
        status: "BLOCKED",
        executedAt: at("2026-01-01T00:00:00Z"),
      },
    ]);
    expect(map.get("a")?.status).toBe("PASS");
    expect(map.get("b")?.status).toBe("BLOCKED");
  });

  it("is order-independent", () => {
    const map = latestByCase([
      { testCaseId: "a", status: "PASS", executedAt: at("2026-01-02T00:00:00Z") },
      { testCaseId: "a", status: "FAIL", executedAt: at("2026-01-01T00:00:00Z") },
    ]);
    expect(map.get("a")?.status).toBe("PASS");
  });
});

describe("summarizeLatest", () => {
  it("computes pass rate and breakdown", () => {
    const summary = summarizeLatest([
      { testCaseId: "a", status: "PASS", executedAt: at("2026-01-01") },
      { testCaseId: "b", status: "FAIL", executedAt: at("2026-01-01") },
      { testCaseId: "c", status: "PASS", executedAt: at("2026-01-01") },
      { testCaseId: "d", status: "BLOCKED", executedAt: at("2026-01-01") },
    ]);
    expect(summary.total).toBe(4);
    expect(summary.passed).toBe(2);
    expect(summary.failed).toBe(1);
    expect(summary.passRate).toBe(50);
    expect(summary.breakdown.map((item) => item.label)).toEqual([
      "PASS",
      "FAIL",
      "BLOCKED",
      "SKIPPED",
    ]);
  });

  it("handles empty input", () => {
    const summary = summarizeLatest([]);
    expect(summary.passRate).toBe(0);
    expect(summary.total).toBe(0);
  });
});

describe("executionTrend", () => {
  it("buckets by local day and counts passes", () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    const trend = executionTrend(
      [
        { status: "PASS", executedAt: today },
        { status: "FAIL", executedAt: today },
      ],
      7,
    );

    expect(trend).toHaveLength(7);
    const last = trend[trend.length - 1];
    expect(last.executed).toBe(2);
    expect(last.passed).toBe(1);
  });

  it("ignores executions outside the window", () => {
    const old = new Date();
    old.setDate(old.getDate() - 30);

    const trend = executionTrend([{ status: "PASS", executedAt: old }], 7);
    expect(trend.reduce((sum, point) => sum + point.executed, 0)).toBe(0);
  });
});
