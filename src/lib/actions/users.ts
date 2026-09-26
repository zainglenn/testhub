"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { recordAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/authz";
import { hashPassword } from "@/lib/password";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  firstError,
  formToObject,
  userCreateInput,
  userUpdateInput,
} from "@/lib/validation";
import { getWorkspace } from "@/lib/workspace";

function requireAdmin() {
  return requirePermission(PERMISSIONS.WORKSPACE_MANAGE);
}

export async function createUser(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requireAdmin())) {
    return { ok: false, error: "You are not authorised to manage users." };
  }

  const parsed = userCreateInput.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error) };
  }

  const { name, email, password, role } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "A user with that email already exists." };
  }

  const created = await prisma.user.create({
    data: { name, email, passwordHash: hashPassword(password), role },
  });

  const workspace = await getWorkspace();
  await prisma.workspaceMember.create({
    data: { workspaceId: workspace.id, userId: created.id },
  });

  await recordAudit({
    workspaceId: workspace.id,
    actorId: (await getSession())?.userId ?? null,
    action: "user.create",
    entityType: "user",
    entityId: created.id,
  });

  revalidatePath("/workspace/users");
  return { ok: true };
}

export async function updateUser(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requireAdmin())) {
    return { ok: false, error: "You are not authorised to manage users." };
  }

  const parsed = userUpdateInput.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error) };
  }

  const { id, name, role, password } = parsed.data;

  const data: { name: string; role: string; passwordHash?: string } = {
    name,
    role,
  };

  if (password && password.length > 0) {
    if (password.length < 8) {
      return { ok: false, error: "Password must be at least 8 characters." };
    }
    data.passwordHash = hashPassword(password);
  }

  await prisma.user.update({ where: { id }, data });

  const workspace = await getWorkspace();
  await recordAudit({
    workspaceId: workspace.id,
    actorId: (await getSession())?.userId ?? null,
    action: "user.update",
    entityType: "user",
    entityId: id,
  });

  revalidatePath("/workspace/users");
  return { ok: true };
}

export async function revokeUserSessions(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  if (!session) return;

  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;

  await prisma.session.deleteMany({ where: { userId } });

  const workspace = await getWorkspace();
  await recordAudit({
    workspaceId: workspace.id,
    actorId: session.userId,
    action: "auth.adminRevokeSessions",
    entityType: "user",
    entityId: userId,
  });

  revalidatePath("/workspace/users");
}

export async function setMemberRole(
  userId: string,
  roleId: string | null,
): Promise<void> {
  const session = await requirePermission(PERMISSIONS.WORKSPACE_MANAGE);
  if (!session) return;

  const workspace = await getWorkspace();
  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: { workspaceId: workspace.id, userId },
    },
    create: { workspaceId: workspace.id, userId, roleId },
    update: { roleId },
  });

  await recordAudit({
    workspaceId: workspace.id,
    actorId: session.userId,
    action: "member.role",
    entityType: "user",
    entityId: userId,
    metadata: { roleId },
  });

  revalidatePath("/workspace/users");
}

export async function deleteUser(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  if (!session) return;

  const id = String(formData.get("id") ?? "");
  if (!id || id === session.userId) return;

  await prisma.user.delete({ where: { id } });

  const workspace = await getWorkspace();
  await recordAudit({
    workspaceId: workspace.id,
    actorId: session.userId,
    action: "user.delete",
    entityType: "user",
    entityId: id,
  });

  revalidatePath("/workspace/users");
}
