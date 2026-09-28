"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { requirePermission } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  firstError,
  formToObject,
  testCasePreconditionInput,
} from "@/lib/validation";
import { projectInActiveWorkspace } from "@/lib/workspace";

export async function attachPrecondition(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requirePermission(PERMISSIONS.CASE_MANAGE))) {
    return { ok: false, error: "You do not have permission to edit cases." };
  }
  const parsed = testCasePreconditionInput.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error) };
  }
  const { testCaseId, preconditionId } = parsed.data;

  const testCase = await prisma.testCase.findUnique({
    where: { id: testCaseId },
    select: { projectId: true, project: { select: { workspaceId: true } } },
  });
  if (!testCase || !(await projectInActiveWorkspace(testCase.projectId))) {
    return { ok: false, error: "Test case not found in this workspace." };
  }

  const precondition = await prisma.precondition.findFirst({
    where: {
      id: preconditionId,
      ...(testCase.project.workspaceId
        ? { workspaceId: testCase.project.workspaceId }
        : {}),
    },
    select: { id: true },
  });
  if (!precondition) {
    return { ok: false, error: "Precondition not found in this workspace." };
  }

  await prisma.testCasePrecondition.upsert({
    where: { testCaseId_preconditionId: { testCaseId, preconditionId } },
    create: { testCaseId, preconditionId },
    update: {},
  });

  revalidatePath(`/projects/${testCase.projectId}/cases`);
  return { ok: true };
}

export async function detachPrecondition(formData: FormData): Promise<void> {
  if (!(await requirePermission(PERMISSIONS.CASE_MANAGE))) return;
  const linkId = String(formData.get("linkId") ?? "");
  if (!linkId) return;

  const link = await prisma.testCasePrecondition.findUnique({
    where: { id: linkId },
    select: { testCaseId: true, testCase: { select: { projectId: true } } },
  });
  if (!link || !(await projectInActiveWorkspace(link.testCase.projectId))) return;

  await prisma.testCasePrecondition.delete({ where: { id: linkId } });
  revalidatePath(`/projects/${link.testCase.projectId}/cases`);
}
