"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/authz";
import { deriveStatusFromSteps } from "@/lib/execution";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { commentCaseResult } from "@/lib/jira/sync";
import { removeObject } from "@/lib/supabase-storage";
import {
  clearStepResultInput,
  executionInput,
  firstError,
  formToObject,
  stepResultInput,
} from "@/lib/validation";
import { projectInActiveWorkspace } from "@/lib/workspace";

function revalidateRun(projectId: string) {
  revalidatePath(`/projects/${projectId}/cases`);
  revalidatePath(`/projects/${projectId}/reports`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
}

async function removeEvidenceObjects(executionIds: string[]) {
  if (executionIds.length === 0) return;
  const rows = await prisma.evidence.findMany({
    where: { executionId: { in: executionIds } },
    select: { storageKey: true },
  });
  for (const row of rows) {
    await removeObject(row.storageKey);
  }
}

/**
 * Recomputes the case-level status from its step results and, when it changes,
 * persists it and posts the Jira result comment once (not per step).
 */
async function recomputeExecutionStatus(
  executionId: string,
  context?: string,
): Promise<void> {
  const execution = await prisma.testExecution.findUnique({
    where: { id: executionId },
    select: {
      id: true,
      testCaseId: true,
      status: true,
      stepResults: { select: { status: true } },
    },
  });
  if (!execution) return;

  const derived = deriveStatusFromSteps(
    execution.stepResults.map((step) => step.status),
  );
  if (!derived || derived === execution.status) return;

  await prisma.testExecution.update({
    where: { id: executionId },
    data: { status: derived },
  });
  await commentCaseResult(execution.testCaseId, derived, context);
}

async function applyStepResult(
  raw: Record<string, unknown>,
): Promise<ActionState> {
  if (!(await requirePermission(PERMISSIONS.RUN_MANAGE))) {
    return { ok: false, error: "You do not have permission to record results." };
  }
  const parsed = stepResultInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error) };
  }
  const { runId, testCaseId, stepId, order, status, comment } = parsed.data;

  const run = await prisma.testRun.findUnique({
    where: { id: runId },
    select: { projectId: true, status: true, name: true },
  });
  if (!run || run.status === "COMPLETED") {
    return { ok: false, error: "This run is completed." };
  }
  if (!(await projectInActiveWorkspace(run.projectId))) {
    return { ok: false, error: "Run not found in this workspace." };
  }

  const session = await getSession();
  const executedAt = new Date();

  const execution = await prisma.testExecution.upsert({
    where: { runId_testCaseId: { runId, testCaseId } },
    create: {
      runId,
      testCaseId,
      projectId: run.projectId,
      status,
      executedAt,
      executedById: session?.userId ?? null,
    },
    update: { executedAt, executedById: session?.userId ?? null },
    select: { id: true },
  });

  await prisma.testExecutionStep.upsert({
    where: { executionId_order: { executionId: execution.id, order } },
    create: {
      executionId: execution.id,
      testStepId: stepId,
      order,
      status,
      comment,
    },
    update: { testStepId: stepId, status, comment },
  });

  await recomputeExecutionStatus(execution.id, `Run "${run.name}"`);

  revalidatePath(`/projects/${run.projectId}/runs/${runId}`);
  revalidatePath(`/projects/${run.projectId}/runs`);
  revalidateRun(run.projectId);
  return { ok: true };
}

/** Form-action variant (used by the per-step dialog, which can set a comment). */
export async function setStepResult(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return applyStepResult(formToObject(formData));
}

/** Immediate variant used by the per-step status toggle. */
export async function toggleStepResult(formData: FormData): Promise<void> {
  await applyStepResult(formToObject(formData));
}

export async function clearStepResult(formData: FormData): Promise<void> {
  if (!(await requirePermission(PERMISSIONS.RUN_MANAGE))) return;
  const parsed = clearStepResultInput.safeParse(formToObject(formData));
  if (!parsed.success) return;
  const { runId, testCaseId, order } = parsed.data;

  const run = await prisma.testRun.findUnique({
    where: { id: runId },
    select: { projectId: true, status: true, name: true },
  });
  if (!run || run.status === "COMPLETED") return;
  if (!(await projectInActiveWorkspace(run.projectId))) return;

  const execution = await prisma.testExecution.findUnique({
    where: { runId_testCaseId: { runId, testCaseId } },
    select: { id: true },
  });
  if (!execution) return;

  await prisma.testExecutionStep.deleteMany({
    where: { executionId: execution.id, order },
  });

  const remaining = await prisma.testExecutionStep.count({
    where: { executionId: execution.id },
  });
  if (remaining === 0) {
    // No step results left: drop the execution (and its evidence) so the case
    // returns to "not executed", mirroring clearRunResult.
    await removeEvidenceObjects([execution.id]);
    await prisma.testExecution.delete({ where: { id: execution.id } });
  } else {
    await recomputeExecutionStatus(execution.id, `Run "${run.name}"`);
  }

  revalidatePath(`/projects/${run.projectId}/runs/${runId}`);
  revalidatePath(`/projects/${run.projectId}/runs`);
  revalidateRun(run.projectId);
}

export async function recordExecution(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requirePermission(PERMISSIONS.RUN_MANAGE))) {
    return { ok: false, error: "You do not have permission to record executions." };
  }
  const parsed = executionInput.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error) };
  }

  const { testCaseId, status, comment, dataset } = parsed.data;

  const testCase = await prisma.testCase.findUnique({
    where: { id: testCaseId },
    select: { projectId: true },
  });
  if (!testCase) {
    return { ok: false, error: "Test case not found" };
  }
  if (!(await projectInActiveWorkspace(testCase.projectId))) {
    return { ok: false, error: "Test case not found in this workspace." };
  }

  const session = await getSession();

  await prisma.testExecution.create({
    data: {
      testCaseId,
      projectId: testCase.projectId,
      status,
      comment,
      dataset: dataset ?? null,
      executedById: session?.userId ?? null,
    },
  });

  await commentCaseResult(testCaseId, status);

  revalidatePath(`/projects/${testCase.projectId}/cases`);
  revalidatePath(`/projects/${testCase.projectId}/reports`);
  revalidatePath("/");
  return { ok: true };
}

export async function deleteExecution(formData: FormData): Promise<void> {
  if (!(await requirePermission(PERMISSIONS.RUN_MANAGE))) return;
  const id = String(formData.get("id") ?? "");
  const testCaseId = String(formData.get("testCaseId") ?? "");
  if (!id) return;

  const execution = await prisma.testExecution.findUnique({
    where: { id },
    select: { projectId: true },
  });
  if (!execution || !(await projectInActiveWorkspace(execution.projectId))) return;

  await removeEvidenceObjects([id]);
  await prisma.testExecution.delete({ where: { id } });

  if (testCaseId && execution) {
    revalidatePath(`/projects/${execution.projectId}/cases`);
  }
  if (execution) revalidatePath(`/projects/${execution.projectId}/reports`);
  revalidatePath("/");
}
