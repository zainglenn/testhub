"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { recordAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/authz";
import { ALL_PERMISSIONS, PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  fieldInput,
  firstError,
  formToObject,
  groupInput,
  parameterInput,
  roleInput,
  sharedStepInput,
  sharedStepItemInput,
  ssoInput,
  workspaceTagInput,
} from "@/lib/validation";
import { WORKSPACE_COOKIE, getWorkspace } from "@/lib/workspace";

async function context() {
  const session = await requirePermission(PERMISSIONS.WORKSPACE_MANAGE);
  if (!session) return null;
  const workspace = await getWorkspace();
  return { session, workspace };
}

function audit(
  workspaceId: string,
  actorId: string,
  action: string,
  entityId?: string,
) {
  return recordAudit({ workspaceId, actorId, action, entityId });
}

/* ----------------------------- Groups ------------------------------------ */

export async function createGroup(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await context();
  if (!ctx) return { ok: false, error: "Not authorised." };
  const parsed = groupInput.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const group = await prisma.group.create({
    data: { workspaceId: ctx.workspace.id, ...parsed.data },
  });
  await audit(ctx.workspace.id, ctx.session.userId, "group.create", group.id);
  revalidatePath("/workspace/groups");
  return { ok: true };
}

export async function updateGroup(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await context();
  if (!ctx) return { ok: false, error: "Not authorised." };
  const id = String(formData.get("id") ?? "");
  const parsed = groupInput.safeParse(formToObject(formData));
  if (!id || !parsed.success) {
    return { ok: false, error: parsed.success ? "Missing id." : firstError(parsed.error) };
  }
  await prisma.group.updateMany({
    where: { id, workspaceId: ctx.workspace.id },
    data: parsed.data,
  });
  await audit(ctx.workspace.id, ctx.session.userId, "group.update", id);
  revalidatePath("/workspace/groups");
  return { ok: true };
}

export async function deleteGroup(formData: FormData): Promise<void> {
  const ctx = await context();
  if (!ctx) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.group.deleteMany({ where: { id, workspaceId: ctx.workspace.id } });
  await audit(ctx.workspace.id, ctx.session.userId, "group.delete", id);
  revalidatePath("/workspace/groups");
}

/* ------------------------------ Roles ------------------------------------ */

export async function createRole(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await context();
  if (!ctx) return { ok: false, error: "Not authorised." };
  const raw = formToObject(formData);
  raw.permissions = formData
    .getAll("permissions")
    .map(String)
    .filter(Boolean)
    .join(", ");
  const parsed = roleInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  try {
    const role = await prisma.role.create({
      data: {
        workspaceId: ctx.workspace.id,
        name: parsed.data.name,
        description: parsed.data.description,
        permissions: parsed.data.permissions ?? "",
      },
    });
    await audit(ctx.workspace.id, ctx.session.userId, "role.create", role.id);
  } catch {
    return { ok: false, error: "A role with that name already exists." };
  }
  revalidatePath("/workspace/roles");
  return { ok: true };
}

export async function updateRole(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await context();
  if (!ctx) return { ok: false, error: "Not authorised." };
  const id = String(formData.get("id") ?? "");
  const raw = formToObject(formData);
  raw.permissions = formData
    .getAll("permissions")
    .map(String)
    .filter(Boolean)
    .join(", ");
  const parsed = roleInput.safeParse(raw);
  if (!id || !parsed.success) {
    return { ok: false, error: parsed.success ? "Missing id." : firstError(parsed.error) };
  }
  await prisma.role.updateMany({
    where: { id, workspaceId: ctx.workspace.id },
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      permissions: parsed.data.permissions ?? "",
    },
  });
  await audit(ctx.workspace.id, ctx.session.userId, "role.update", id);
  revalidatePath("/workspace/roles");
  return { ok: true };
}

export async function deleteRole(formData: FormData): Promise<void> {
  const ctx = await context();
  if (!ctx) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.role.deleteMany({ where: { id, workspaceId: ctx.workspace.id } });
  await audit(ctx.workspace.id, ctx.session.userId, "role.delete", id);
  revalidatePath("/workspace/roles");
}

/* ------------------------------ Fields ----------------------------------- */

export async function createField(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await context();
  if (!ctx) return { ok: false, error: "Not authorised." };
  const parsed = fieldInput.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const last = await prisma.field.aggregate({
    where: { workspaceId: ctx.workspace.id },
    _max: { order: true },
  });

  const field = await prisma.field.create({
    data: {
      workspaceId: ctx.workspace.id,
      name: parsed.data.name,
      type: parsed.data.type,
      entity: parsed.data.entity,
      options: parsed.data.options ?? "",
      required: parsed.data.required === "on",
      order: (last._max.order ?? -1) + 1,
    },
  });
  await audit(ctx.workspace.id, ctx.session.userId, "field.create", field.id);
  revalidatePath("/workspace/fields");
  return { ok: true };
}

export async function updateField(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await context();
  if (!ctx) return { ok: false, error: "Not authorised." };
  const id = String(formData.get("id") ?? "");
  const parsed = fieldInput.safeParse(formToObject(formData));
  if (!id || !parsed.success) {
    return { ok: false, error: parsed.success ? "Missing id." : firstError(parsed.error) };
  }
  await prisma.field.updateMany({
    where: { id, workspaceId: ctx.workspace.id },
    data: {
      name: parsed.data.name,
      type: parsed.data.type,
      entity: parsed.data.entity,
      options: parsed.data.options ?? "",
      required: parsed.data.required === "on",
    },
  });
  await audit(ctx.workspace.id, ctx.session.userId, "field.update", id);
  revalidatePath("/workspace/fields");
  return { ok: true };
}

export async function deleteField(formData: FormData): Promise<void> {
  const ctx = await context();
  if (!ctx) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.field.deleteMany({ where: { id, workspaceId: ctx.workspace.id } });
  await audit(ctx.workspace.id, ctx.session.userId, "field.delete", id);
  revalidatePath("/workspace/fields");
}

/* ---------------------------- Parameters --------------------------------- */

export async function createParameter(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await context();
  if (!ctx) return { ok: false, error: "Not authorised." };
  const parsed = parameterInput.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const parameter = await prisma.parameter.create({
    data: {
      workspaceId: ctx.workspace.id,
      name: parsed.data.name,
      values: parsed.data.values ?? "",
    },
  });
  await audit(ctx.workspace.id, ctx.session.userId, "parameter.create", parameter.id);
  revalidatePath("/workspace/parameters");
  return { ok: true };
}

export async function updateParameter(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await context();
  if (!ctx) return { ok: false, error: "Not authorised." };
  const id = String(formData.get("id") ?? "");
  const parsed = parameterInput.safeParse(formToObject(formData));
  if (!id || !parsed.success) {
    return { ok: false, error: parsed.success ? "Missing id." : firstError(parsed.error) };
  }
  await prisma.parameter.updateMany({
    where: { id, workspaceId: ctx.workspace.id },
    data: { name: parsed.data.name, values: parsed.data.values ?? "" },
  });
  await audit(ctx.workspace.id, ctx.session.userId, "parameter.update", id);
  revalidatePath("/workspace/parameters");
  return { ok: true };
}

export async function deleteParameter(formData: FormData): Promise<void> {
  const ctx = await context();
  if (!ctx) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.parameter.deleteMany({ where: { id, workspaceId: ctx.workspace.id } });
  await audit(ctx.workspace.id, ctx.session.userId, "parameter.delete", id);
  revalidatePath("/workspace/parameters");
}

/* --------------------------- Shared steps -------------------------------- */

export async function createSharedStep(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await context();
  if (!ctx) return { ok: false, error: "Not authorised." };
  const parsed = sharedStepInput.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const step = await prisma.sharedStep.create({
    data: { workspaceId: ctx.workspace.id, title: parsed.data.title },
  });
  await audit(ctx.workspace.id, ctx.session.userId, "sharedStep.create", step.id);
  revalidatePath("/workspace/shared-steps");
  return { ok: true };
}

export async function deleteSharedStep(formData: FormData): Promise<void> {
  const ctx = await context();
  if (!ctx) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.sharedStep.deleteMany({
    where: { id, workspaceId: ctx.workspace.id },
  });
  await audit(ctx.workspace.id, ctx.session.userId, "sharedStep.delete", id);
  revalidatePath("/workspace/shared-steps");
}

export async function addSharedStepItem(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await context();
  if (!ctx) return { ok: false, error: "Not authorised." };
  const parsed = sharedStepItemInput.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const sharedStep = await prisma.sharedStep.findFirst({
    where: { id: parsed.data.sharedStepId, workspaceId: ctx.workspace.id },
    select: { id: true },
  });
  if (!sharedStep) return { ok: false, error: "Shared step not found." };

  const last = await prisma.sharedStepItem.aggregate({
    where: { sharedStepId: parsed.data.sharedStepId },
    _max: { order: true },
  });
  await prisma.sharedStepItem.create({
    data: {
      sharedStepId: parsed.data.sharedStepId,
      action: parsed.data.action,
      expectedResult: parsed.data.expectedResult,
      order: (last._max.order ?? -1) + 1,
    },
  });
  revalidatePath("/workspace/shared-steps");
  return { ok: true };
}

export async function deleteSharedStepItem(formData: FormData): Promise<void> {
  const ctx = await context();
  if (!ctx) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.sharedStepItem.deleteMany({
    where: { id, sharedStep: { workspaceId: ctx.workspace.id } },
  });
  revalidatePath("/workspace/shared-steps");
}

/* --------------------------- Workspace tags ------------------------------ */

export async function createWorkspaceTag(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await context();
  if (!ctx) return { ok: false, error: "Not authorised." };
  const parsed = workspaceTagInput.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  try {
    await prisma.workspaceTag.create({
      data: {
        workspaceId: ctx.workspace.id,
        name: parsed.data.name,
        nameKey: parsed.data.name.toLowerCase(),
      },
    });
  } catch {
    return { ok: false, error: "That tag already exists." };
  }
  revalidatePath("/workspace/tags");
  return { ok: true };
}

export async function deleteWorkspaceTag(formData: FormData): Promise<void> {
  const ctx = await context();
  if (!ctx) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.workspaceTag.deleteMany({
    where: { id, workspaceId: ctx.workspace.id },
  });
  revalidatePath("/workspace/tags");
}

/* -------------------------------- SSO ------------------------------------ */

export async function saveSso(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await context();
  if (!ctx) return { ok: false, error: "Not authorised." };
  const parsed = ssoInput.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  await prisma.ssoConfig.upsert({
    where: { workspaceId: ctx.workspace.id },
    create: {
      workspaceId: ctx.workspace.id,
      enabled: parsed.data.enabled === "on",
      provider: parsed.data.provider,
      issuerUrl: parsed.data.issuerUrl,
      clientId: parsed.data.clientId,
      clientSecret: parsed.data.clientSecret,
    },
    update: {
      enabled: parsed.data.enabled === "on",
      provider: parsed.data.provider,
      issuerUrl: parsed.data.issuerUrl,
      clientId: parsed.data.clientId,
      clientSecret: parsed.data.clientSecret,
    },
  });
  await audit(ctx.workspace.id, ctx.session.userId, "sso.update");
  revalidatePath("/workspace/sso");
  return { ok: true };
}

/* --------------------------- Workspace switching ------------------------- */

const COOKIE_OPTIONS = {
  path: "/",
  httpOnly: true,
  sameSite: "lax",
  maxAge: 60 * 60 * 24 * 365,
} as const;

export async function switchWorkspace(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const id = String(formData.get("workspaceId") ?? "");
  if (!id) return;

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: id, userId: session.userId } },
  });
  if (!member) return;

  const store = await cookies();
  store.set(WORKSPACE_COOKIE, id, COOKIE_OPTIONS);
  revalidatePath("/", "layout");
  redirect("/projects");
}

export async function createWorkspace(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) {
    return { ok: false, error: "Enter a workspace name (at least 2 characters)." };
  }

  const workspace = await prisma.workspace.create({ data: { name } });

  const owner = await prisma.role.create({
    data: {
      workspaceId: workspace.id,
      name: "Owner",
      description: "Full access to this workspace",
      permissions: ALL_PERMISSIONS.join(", "),
    },
  });

  await prisma.workspaceMember.create({
    data: { workspaceId: workspace.id, userId: session.userId, roleId: owner.id },
  });

  await recordAudit({
    workspaceId: workspace.id,
    actorId: session.userId,
    action: "workspace.create",
  });

  const store = await cookies();
  store.set(WORKSPACE_COOKIE, workspace.id, COOKIE_OPTIONS);
  revalidatePath("/", "layout");
  redirect("/workspace");
}
