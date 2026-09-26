"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { requirePermission } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { projectInActiveWorkspace } from "@/lib/workspace";

async function guard(projectId: string) {
  const session = await requirePermission(PERMISSIONS.PROJECT_MANAGE);
  if (!session) return null;
  if (!(await projectInActiveWorkspace(projectId))) return null;
  return session;
}

export async function setProjectRestricted(formData: FormData): Promise<void> {
  const projectId = String(formData.get("id") ?? "");
  if (!projectId || !(await guard(projectId))) return;

  await prisma.project.update({
    where: { id: projectId },
    data: { restricted: formData.get("restricted") === "on" },
  });
  revalidatePath(`/projects/${projectId}/settings`);
  revalidatePath("/projects");
}

export async function addProjectMember(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const projectId = String(formData.get("projectId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  if (!projectId || !userId) {
    return { ok: false, error: "Choose a workspace member." };
  }
  if (!(await guard(projectId))) {
    return { ok: false, error: "Not authorised." };
  }

  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId } },
    create: { projectId, userId },
    update: {},
  });
  revalidatePath(`/projects/${projectId}/settings`);
  return { ok: true };
}

export async function removeProjectMember(formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  if (!projectId || !userId) return;
  if (!(await guard(projectId))) return;

  await prisma.projectMember.deleteMany({ where: { projectId, userId } });
  revalidatePath(`/projects/${projectId}/settings`);
}
