export const PERMISSIONS = {
  WORKSPACE_MANAGE: "workspace.manage",
  PROJECT_MANAGE: "project.manage",
  CASE_MANAGE: "case.manage",
  RUN_MANAGE: "run.manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

export const PERMISSION_LABELS: Record<string, string> = {
  "workspace.manage": "Manage workspace (users, groups, roles, settings)",
  "project.manage": "Create and manage projects",
  "case.manage": "Manage test cases, suites and tags",
  "run.manage": "Create and manage test runs",
};
