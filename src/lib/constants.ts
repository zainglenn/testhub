export type ChipColor =
  | "default"
  | "primary"
  | "secondary"
  | "error"
  | "info"
  | "success"
  | "warning";

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export const CASE_STATUSES = ["DRAFT", "ACTIVE", "DEPRECATED"] as const;

export const EXECUTION_STATUSES = ["PASS", "FAIL", "BLOCKED", "SKIPPED"] as const;
export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];

export const PRIORITY_COLORS: Record<string, ChipColor> = {
  LOW: "default",
  MEDIUM: "info",
  HIGH: "warning",
  CRITICAL: "error",
};

export const STATUS_COLORS: Record<string, ChipColor> = {
  DRAFT: "default",
  ACTIVE: "success",
  DEPRECATED: "error",
};

export const EXECUTION_COLORS: Record<string, ChipColor> = {
  PASS: "success",
  FAIL: "error",
  BLOCKED: "warning",
  SKIPPED: "default",
};

export const RUN_COLORS: Record<string, ChipColor> = {
  OPEN: "info",
  COMPLETED: "success",
};

export function isExecutionStatus(value: string): value is ExecutionStatus {
  return (EXECUTION_STATUSES as readonly string[]).includes(value);
}
