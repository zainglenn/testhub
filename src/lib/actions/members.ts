"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { recordAudit } from "@/lib/audit";
import { startSession } from "@/lib/auth-session";
import { requirePermission } from "@/lib/authz";
import { hashPassword } from "@/lib/password";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  acceptInvitationInput,
  firstError,
  formToObject,
  inviteMemberInput,
} from "@/lib/validation";
import { WORKSPACE_COOKIE, getWorkspace } from "@/lib/workspace";

const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export async function inviteMember(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requirePermission(PERMISSIONS.WORKSPACE_MANAGE);
  if (!session) return { ok: false, error: "Not authorised." };

  const parsed = inviteMemberInput.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const email = parsed.data.email;
  const roleId =
    parsed.data.roleId && parsed.data.roleId !== "none"
      ? parsed.data.roleId
      : null;

  const workspace = await getWorkspace();

  if (roleId) {
    const role = await prisma.role.findFirst({
      where: { id: roleId, workspaceId: workspace.id },
      select: { id: true },
    });
    if (!role) return { ok: false, error: "Role not found in this workspace." };
  }

  // An account that already exists can be added directly — no invite needed.
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId: workspace.id, userId: existing.id },
      },
    });
    if (member) {
      return { ok: false, error: "That person is already a member of this workspace." };
    }

    await prisma.workspaceMember.create({
      data: { workspaceId: workspace.id, userId: existing.id, roleId },
    });
    await recordAudit({
      workspaceId: workspace.id,
      actorId: session.userId,
      action: "member.add",
      entityType: "user",
      entityId: existing.id,
    });
    revalidatePath("/workspace/users");
    return { ok: true };
  }

  const token = crypto.randomBytes(24).toString("base64url");
  const invitation = await prisma.invitation.upsert({
    where: { workspaceId_email: { workspaceId: workspace.id, email } },
    create: {
      workspaceId: workspace.id,
      email,
      roleId,
      token,
      status: "PENDING",
      invitedById: session.userId,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
    update: {
      roleId,
      token,
      status: "PENDING",
      invitedById: session.userId,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      acceptedAt: null,
    },
  });

  await recordAudit({
    workspaceId: workspace.id,
    actorId: session.userId,
    action: "invitation.create",
    entityType: "invitation",
    entityId: invitation.id,
  });
  revalidatePath("/workspace/users");
  redirect(`/workspace/users?invited=${invitation.id}`);
}

export async function revokeInvitation(formData: FormData): Promise<void> {
  const session = await requirePermission(PERMISSIONS.WORKSPACE_MANAGE);
  if (!session) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const workspace = await getWorkspace();
  await prisma.invitation.updateMany({
    where: { id, workspaceId: workspace.id },
    data: { status: "REVOKED" },
  });
  await recordAudit({
    workspaceId: workspace.id,
    actorId: session.userId,
    action: "invitation.revoke",
    entityType: "invitation",
    entityId: id,
  });
  revalidatePath("/workspace/users");
}

export async function removeMember(formData: FormData): Promise<void> {
  const session = await requirePermission(PERMISSIONS.WORKSPACE_MANAGE);
  if (!session) return;
  const userId = String(formData.get("userId") ?? "");
  if (!userId || userId === session.userId) return;

  const workspace = await getWorkspace();
  await prisma.workspaceMember.deleteMany({
    where: { workspaceId: workspace.id, userId },
  });
  await recordAudit({
    workspaceId: workspace.id,
    actorId: session.userId,
    action: "member.remove",
    entityType: "user",
    entityId: userId,
  });
  revalidatePath("/workspace/users");
}

export async function acceptInvitation(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = acceptInvitationInput.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const { token, name, password } = parsed.data;

  const invitation = await prisma.invitation.findUnique({ where: { token } });
  if (!invitation || invitation.status !== "PENDING") {
    return { ok: false, error: "This invitation is no longer valid." };
  }
  if (invitation.expiresAt.getTime() < Date.now()) {
    return {
      ok: false,
      error: "This invitation has expired. Ask an admin to resend it.",
    };
  }

  const existing = await prisma.user.findUnique({
    where: { email: invitation.email },
  });
  if (existing) {
    return {
      ok: false,
      error: "An account with this email already exists. Please sign in instead.",
    };
  }

  const user = await prisma.user.create({
    data: {
      name,
      email: invitation.email,
      passwordHash: hashPassword(password),
      role: "MEMBER",
    },
  });

  await prisma.workspaceMember.create({
    data: {
      workspaceId: invitation.workspaceId,
      userId: user.id,
      roleId: invitation.roleId,
    },
  });

  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { status: "ACCEPTED", acceptedAt: new Date() },
  });

  await startSession(user);

  const store = await cookies();
  store.set(WORKSPACE_COOKIE, invitation.workspaceId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  await recordAudit({
    workspaceId: invitation.workspaceId,
    actorId: user.id,
    action: "invitation.accept",
    entityType: "invitation",
    entityId: invitation.id,
  });

  redirect("/projects");
}
