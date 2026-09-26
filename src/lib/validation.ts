import { z } from "zod";
import { CASE_STATUSES, EXECUTION_STATUSES, PRIORITIES } from "./constants";

const optionalText = z
  .string()
  .trim()
  .max(4000)
  .optional()
  .transform((value) => (value ? value : null));

export const projectInput = z.object({
  key: z
    .string()
    .trim()
    .min(2, "Key must be at least 2 characters")
    .max(12, "Key must be at most 12 characters")
    .regex(/^[A-Z][A-Z0-9]*$/, "Use uppercase letters and numbers only"),
  name: z.string().trim().min(1, "Name is required").max(120),
  description: optionalText,
});

export const projectUpdateInput = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "Name is required").max(120),
  description: optionalText,
});

export const planInput = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(1, "Name is required").max(120),
  description: optionalText,
});

export const planUpdateInput = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "Name is required").max(120),
  description: optionalText,
  status: z.enum(["OPEN", "COMPLETED"]).default("OPEN"),
});

export const suiteInput = z.object({
  projectId: z.string().min(1),
  parentId: z.string().min(1).optional().nullable(),
  name: z.string().trim().min(1, "Name is required").max(120),
  description: optionalText,
});

export const testCaseInput = z.object({
  projectId: z.string().min(1),
  suiteId: z.string().min(1).optional().nullable(),
  title: z.string().trim().min(1, "Title is required").max(300),
  description: optionalText,
  preconditions: optionalText,
  priority: z.enum(PRIORITIES).default("MEDIUM"),
});

export const testCaseUpdateInput = testCaseInput.extend({
  id: z.string().min(1),
  status: z.enum(CASE_STATUSES).default("DRAFT"),
});

export const testStepInput = z.object({
  testCaseId: z.string().min(1),
  action: z.string().trim().min(1, "Action is required").max(2000),
  expectedResult: optionalText,
});

export const testStepUpdateInput = testStepInput.extend({
  id: z.string().min(1),
});

export const executionInput = z.object({
  testCaseId: z.string().min(1),
  status: z.enum(EXECUTION_STATUSES).default("PASS"),
  comment: optionalText,
  dataset: z.string().trim().max(120).optional(),
});

export const runInput = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(1, "Name is required").max(160),
  description: optionalText,
  environment: optionalText,
  scope: z.enum(["ALL", "SUITE", "TAG"]).default("ALL"),
  suiteId: z.string().min(1).optional().nullable(),
  tagId: z.string().min(1).optional().nullable(),
});

export const tagInput = z.object({
  testCaseId: z.string().min(1),
  name: z.string().trim().min(1, "Tag is required").max(40),
});

export const tagRenameInput = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "Tag is required").max(40),
});

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "Enter a valid email address");

export const loginInput = z.object({
  email: emailField,
  password: z.string().min(1, "Password is required"),
});

const roleField = z.enum(["ADMIN", "MEMBER"]);

export const userCreateInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: emailField,
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100),
  role: roleField.default("MEMBER"),
});

export const userUpdateInput = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "Name is required").max(80),
  role: roleField.default("MEMBER"),
  password: z.string().max(100).optional(),
});

export const groupInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  description: optionalText,
});

export const roleInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  description: optionalText,
  permissions: z.string().trim().max(500).optional(),
});

export const FIELD_TYPES = ["TEXT", "NUMBER", "DATE", "CHECKBOX", "SELECT"] as const;

export const fieldInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  type: z.enum(FIELD_TYPES).default("TEXT"),
  entity: z.string().trim().max(40).default("CASE"),
  options: z.string().trim().max(500).optional(),
  required: z.string().optional(),
});

export const parameterInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  values: z.string().trim().max(500).optional(),
});

export const sharedStepInput = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
});

export const sharedStepItemInput = z.object({
  sharedStepId: z.string().min(1),
  action: z.string().trim().min(1, "Action is required").max(2000),
  expectedResult: optionalText,
});

export const workspaceTagInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(40),
});

export const ssoInput = z.object({
  enabled: z.string().optional(),
  provider: z.string().trim().max(40).default("OIDC"),
  issuerUrl: optionalText,
  clientId: optionalText,
  clientSecret: optionalText,
});

export const inviteMemberInput = z.object({
  email: emailField,
  roleId: z.string().trim().optional(),
});

export const acceptInvitationInput = z.object({
  token: z.string().min(1),
  name: z.string().trim().min(1, "Name is required").max(80),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100),
});

export function formToObject(formData: FormData): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      result[key] = value;
    }
  }
  return result;
}

export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}
