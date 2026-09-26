"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  isStorageConfigured,
  removeObject,
  uploadObject,
} from "@/lib/supabase-storage";
import { getWorkspace } from "@/lib/workspace";

function extensionOf(filename: string): string {
  return (filename.match(/\.[A-Za-z0-9]{1,12}$/)?.[0] ?? "").toLowerCase();
}

export async function uploadAttachment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdmin();
  if (!session) return { ok: false, error: "Not authorised." };

  if (!isStorageConfigured()) {
    return {
      ok: false,
      error: "File storage is not configured on this deployment.",
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a file to upload." };
  }
  if (file.size > 5_000_000) {
    return { ok: false, error: "File is too large (max 5 MB)." };
  }

  const workspace = await getWorkspace();
  const storageKey = `${crypto.randomUUID()}${extensionOf(file.name)}`;

  try {
    await uploadObject(
      storageKey,
      Buffer.from(await file.arrayBuffer()),
      file.type || "application/octet-stream",
    );
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Upload failed.",
    };
  }

  const attachment = await prisma.attachment.create({
    data: {
      workspaceId: workspace.id,
      filename: file.name.slice(0, 200),
      mime: file.type || null,
      size: file.size,
      storageKey,
      uploadedById: session.userId,
    },
  });

  await recordAudit({
    workspaceId: workspace.id,
    actorId: session.userId,
    action: "attachment.upload",
    entityId: attachment.id,
  });
  revalidatePath("/workspace/attachments");
  return { ok: true };
}

export async function deleteAttachment(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  if (!session) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const attachment = await prisma.attachment.findUnique({ where: { id } });
  if (!attachment) return;

  const workspace = await getWorkspace();
  if (attachment.workspaceId !== workspace.id) return;

  await prisma.attachment.delete({ where: { id } });
  await removeObject(attachment.storageKey);

  await recordAudit({
    workspaceId: workspace.id,
    actorId: session.userId,
    action: "attachment.delete",
    entityId: id,
  });
  revalidatePath("/workspace/attachments");
}
