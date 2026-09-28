"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  isStorageConfigured,
  removeObject,
  uploadObject,
} from "@/lib/supabase-storage";
import { evidenceInput, firstError, formToObject } from "@/lib/validation";
import { getWorkspace, projectInActiveWorkspace } from "@/lib/workspace";

const MAX_EVIDENCE_BYTES = 10_000_000;

function extensionOf(filename: string): string {
  return (filename.match(/\.[A-Za-z0-9]{1,12}$/)?.[0] ?? "").toLowerCase();
}

function revalidateExecution(projectId: string, runId: string | null) {
  if (runId) {
    revalidatePath(`/projects/${projectId}/runs/${runId}`);
    revalidatePath(`/projects/${projectId}/runs`);
  }
  revalidatePath(`/projects/${projectId}/cases`);
  revalidatePath(`/projects/${projectId}`);
}

export async function uploadEvidence(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requirePermission(PERMISSIONS.RUN_MANAGE))) {
    return { ok: false, error: "You do not have permission to add evidence." };
  }
  if (!isStorageConfigured()) {
    return {
      ok: false,
      error: "File storage is not configured on this deployment.",
    };
  }

  const parsed = evidenceInput.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error) };
  }
  const executionStepId = parsed.data.executionStepId
    ? parsed.data.executionStepId
    : null;

  const execution = await prisma.testExecution.findUnique({
    where: { id: parsed.data.executionId },
    select: { id: true, runId: true, projectId: true },
  });
  if (!execution || !(await projectInActiveWorkspace(execution.projectId))) {
    return { ok: false, error: "Execution not found." };
  }

  if (execution.runId) {
    const run = await prisma.testRun.findUnique({
      where: { id: execution.runId },
      select: { status: true },
    });
    if (run?.status === "COMPLETED") {
      return { ok: false, error: "This run is completed." };
    }
  }

  if (executionStepId) {
    const step = await prisma.testExecutionStep.findFirst({
      where: { id: executionStepId, executionId: execution.id },
      select: { id: true },
    });
    if (!step) {
      return { ok: false, error: "Step result not found." };
    }
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a file to upload." };
  }
  if (file.size > MAX_EVIDENCE_BYTES) {
    return { ok: false, error: "File is too large (max 10 MB)." };
  }

  const workspace = await getWorkspace();
  const session = await getSession();
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

  await prisma.evidence.create({
    data: {
      workspaceId: workspace.id,
      executionId: execution.id,
      executionStepId,
      filename: file.name.slice(0, 200),
      mime: file.type || null,
      size: file.size,
      storageKey,
      createdById: session?.userId ?? null,
    },
  });

  revalidateExecution(execution.projectId, execution.runId);
  return { ok: true };
}

export async function deleteEvidence(formData: FormData): Promise<void> {
  if (!(await requirePermission(PERMISSIONS.RUN_MANAGE))) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const evidence = await prisma.evidence.findUnique({
    where: { id },
    select: {
      id: true,
      storageKey: true,
      execution: { select: { projectId: true, runId: true } },
    },
  });
  if (!evidence) return;
  if (!(await projectInActiveWorkspace(evidence.execution.projectId))) return;

  await prisma.evidence.delete({ where: { id } });
  await removeObject(evidence.storageKey);

  revalidateExecution(evidence.execution.projectId, evidence.execution.runId);
}
