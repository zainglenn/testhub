"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { commentCaseResult } from "@/lib/jira/sync";
import { executionInput, firstError, formToObject } from "@/lib/validation";
import { projectInActiveWorkspace } from "@/lib/workspace";

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

  const { testCaseId, status, comment } = parsed.data;

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

  await prisma.testExecution.delete({ where: { id } });

  if (testCaseId && execution) {
    revalidatePath(`/projects/${execution.projectId}/cases`);
  }
  if (execution) revalidatePath(`/projects/${execution.projectId}/reports`);
  revalidatePath("/");
}
