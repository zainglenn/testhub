import { EXECUTION_STATUSES } from "./constants";

export type ExecutionLike = {
  testCaseId: string;
  status: string;
  executedAt: Date;
};

/**
 * The most recent execution per test case. Executions are expected to be
 * passed in any order.
 */
export function latestByCase(
  executions: ExecutionLike[],
): Map<string, ExecutionLike> {
  const map = new Map<string, ExecutionLike>();
  for (const execution of executions) {
    const current = map.get(execution.testCaseId);
    if (!current || execution.executedAt > current.executedAt) {
      map.set(execution.testCaseId, execution);
    }
  }
  return map;
}

export type LatestSummary = {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  breakdown: { label: string; value: number }[];
};

export function summarizeLatest(
  latest: Iterable<ExecutionLike>,
): LatestSummary {
  const values = Array.from(latest);
  const counts: Record<string, number> = {};
  for (const value of values) {
    counts[value.status] = (counts[value.status] ?? 0) + 1;
  }

  const total = values.length;
  const passed = counts.PASS ?? 0;

  return {
    total,
    passed,
    failed: counts.FAIL ?? 0,
    passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
    breakdown: EXECUTION_STATUSES.map((label) => ({
      label,
      value: counts[label] ?? 0,
    })),
  };
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export type TrendPoint = { label: string; executed: number; passed: number };

/** Executions per local calendar day over the trailing `days` window. */
export function executionTrend(
  executions: { status: string; executedAt: Date }[],
  days = 14,
): TrendPoint[] {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  const buckets = Array.from({ length: days }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return {
      label: `${day.getMonth() + 1}/${day.getDate()}`,
      key: dayKey(day),
      executed: 0,
      passed: 0,
    };
  });

  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  for (const execution of executions) {
    const bucket = byKey.get(dayKey(new Date(execution.executedAt)));
    if (!bucket) continue;
    bucket.executed += 1;
    if (execution.status === "PASS") bucket.passed += 1;
  }

  return buckets.map(({ label, executed, passed }) => ({
    label,
    executed,
    passed,
  }));
}
