"use server";

import { revalidatePath } from "next/cache";
import { generateApiToken } from "@/lib/api-token";
import { recordAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getWorkspace, projectInActiveWorkspace, tokenInActiveWorkspace } from "@/lib/workspace";

export async function createApiToken(
  projectId: string,
  name: string,
): Promise<{ ok: boolean; token?: string; error?: string }> {
  const session = await requirePermission(PERMISSIONS.PROJECT_MANAGE);
  if (!session) {
    return { ok: false, error: "You do not have permission to manage tokens." };
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return { ok: false, error: "Give the token a name." };
  }

  if (!(await projectInActiveWorkspace(projectId))) {
    return { ok: false, error: "Project not found in this workspace." };
  }

  const { token, hash, prefix } = generateApiToken();

  await prisma.apiToken.create({
    data: {
      projectId,
      name: trimmed.slice(0, 80),
      tokenHash: hash,
      prefix,
      createdById: session.userId,
    },
  });

  const workspace = await getWorkspace();
  await recordAudit({
    workspaceId: workspace.id,
    actorId: session.userId,
    action: "apiToken.create",
    entityType: "project",
    entityId: projectId,
  });

  revalidatePath(`/projects/${projectId}/settings`);
  return { ok: true, token };
}

export async function deleteApiToken(formData: FormData): Promise<void> {
  const session = await requirePermission(PERMISSIONS.PROJECT_MANAGE);
  if (!session) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const token = await tokenInActiveWorkspace(id);
  if (!token) return;

  await prisma.apiToken.delete({ where: { id } });

  const workspace = await getWorkspace();
  await recordAudit({
    workspaceId: workspace.id,
    actorId: session.userId,
    action: "apiToken.revoke",
    entityType: "project",
    entityId: token.projectId,
  });
  revalidatePath(`/projects/${token.projectId}/settings`);
}
