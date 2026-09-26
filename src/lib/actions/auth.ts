"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { recordAudit } from "@/lib/audit";
import { getSession, safeNextPath } from "@/lib/auth";
import { startSession } from "@/lib/auth-session";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, decodeSession } from "@/lib/session";
import { firstError, formToObject, loginInput } from "@/lib/validation";
import { getWorkspace } from "@/lib/workspace";

const LOCK_THRESHOLD = 5;
const LOCK_MS = 15 * 60 * 1000;


export async function login(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginInput.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error) };
  }

  const { email, password } = parsed.data;
  const next = safeNextPath(String(formData.get("next") ?? ""));

  const user = await prisma.user.findUnique({ where: { email } });
  if (user?.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    return {
      ok: false,
      error: "Too many failed attempts. Try again in a few minutes.",
    };
  }

  if (!user || !verifyPassword(password, user.passwordHash)) {
    if (user) {
      const failedLoginCount = user.failedLoginCount + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount,
          lockedUntil:
            failedLoginCount >= LOCK_THRESHOLD
              ? new Date(Date.now() + LOCK_MS)
              : null,
        },
      });
    }
    return { ok: false, error: "Incorrect email or password." };
  }

  if (user.failedLoginCount > 0 || user.lockedUntil) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
  }

  await startSession(user);
  const workspace = await getWorkspace();
  await recordAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    action: "auth.login",
    entityType: "user",
    entityId: user.id,
  });
  redirect(next);
}

export async function logout(): Promise<void> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (raw) {
    const session = decodeSession(raw);
    if (session) {
      await prisma.session.deleteMany({ where: { id: session.sessionId } });
      const workspace = await getWorkspace();
      await recordAudit({
        workspaceId: workspace.id,
        actorId: session.userId,
        action: "auth.logout",
        entityType: "user",
        entityId: session.userId,
      });
    }
  }
  store.delete(SESSION_COOKIE);
  redirect("/login");
}

export async function changePassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession();
  if (!session) return { ok: false, error: "You are not signed in." };

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword.length < 8) {
    return { ok: false, error: "New password must be at least 8 characters." };
  }
  if (newPassword !== confirmPassword) {
    return { ok: false, error: "New passwords do not match." };
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return { ok: false, error: "Account not found." };
  if (!verifyPassword(currentPassword, user.passwordHash)) {
    return { ok: false, error: "Current password is incorrect." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(newPassword) },
  });
  await prisma.session.deleteMany({
    where: { userId: user.id, NOT: { id: session.sessionId } },
  });

  const workspace = await getWorkspace();
  await recordAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    action: "auth.passwordChange",
    entityType: "user",
    entityId: user.id,
  });

  return { ok: true };
}

export async function revokeSession(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const record = await prisma.session.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!record || record.userId !== session.userId) return;

  await prisma.session.delete({ where: { id } });

  const workspace = await getWorkspace();
  await recordAudit({
    workspaceId: workspace.id,
    actorId: session.userId,
    action: "auth.sessionRevoke",
    entityType: "session",
    entityId: id,
  });

  if (id === session.sessionId) {
    const store = await cookies();
    store.delete(SESSION_COOKIE);
    redirect("/login");
  }
  revalidatePath("/account");
}

export async function signOutEverywhere(): Promise<void> {
  const session = await getSession();
  if (session) {
    await prisma.session.deleteMany({ where: { userId: session.userId } });
    const workspace = await getWorkspace();
    await recordAudit({
      workspaceId: workspace.id,
      actorId: session.userId,
      action: "auth.sessionRevokeAll",
      entityType: "user",
      entityId: session.userId,
    });
  }

  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
