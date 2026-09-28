import { EXECUTION_STATUSES, type ExecutionStatus } from "@/lib/constants";

/**
 * Derives the overall case result from its step results.
 *
 * Precedence: a single FAIL makes the case fail, then any BLOCKED, then any
 * PASS, otherwise the case is treated as SKIPPED. Returns null when no step
 * results have been recorded yet (the caller keeps the manually-set status).
 */
export function deriveStatusFromSteps(
  statuses: string[],
): ExecutionStatus | null {
  if (statuses.length === 0) return null;
  if (statuses.includes("FAIL")) return "FAIL";
  if (statuses.includes("BLOCKED")) return "BLOCKED";
  if (statuses.includes("PASS")) return "PASS";
  if (statuses.includes("SKIPPED")) return "SKIPPED";
  return null;
}

/** Counts step results per status; unknown statuses are ignored. */
export function summarizeStepStatuses(
  statuses: string[],
): Record<ExecutionStatus, number> {
  const counts: Record<ExecutionStatus, number> = {
    PASS: 0,
    FAIL: 0,
    BLOCKED: 0,
    SKIPPED: 0,
  };
  for (const status of statuses) {
    if ((EXECUTION_STATUSES as readonly string[]).includes(status)) {
      counts[status as ExecutionStatus] += 1;
    }
  }
  return counts;
}
