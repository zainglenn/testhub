"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { requirePermission } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  firstError,
  formToObject,
  testSetInput,
  testSetItemInput,
  testSetUpdateInput,
} from "@/lib/validation";
import { projectInActiveWorkspace } from "@/lib/workspace";

async function testSetInActiveWorkspace(id: string) {
  const testSet = await prisma.testSet.findUnique({
    where: { id },
    select: { id: true, projectId: true },
  });
  if (!testSet) return null;
  return (await projectInActiveWorkspace(testSet.projectId)) ? testSet : null;
}

function revalidate(projectId: string) {
  revalidatePath(`/projects/${projectId}/sets`);
  revalidatePath(`/projects/${projectId}/runs`);
}

export async function createTestSet(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requirePermission(PERMISSIONS.CASE_MANAGE))) {
    return { ok: false, error: "You do not have permission to manage test sets." };
  }
  const parsed = testSetInput.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const { projectId, name, description } = parsed.data;
  if (!(await projectInActiveWorkspace(projectId))) {
    return { ok: false, error: "Project not found in this workspace." };
  }

  await prisma.testSet.create({ data: { projectId, name, description } });
  revalidate(projectId);
  return { ok: true };
}

export async function updateTestSet(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requirePermission(PERMISSIONS.CASE_MANAGE))) {
    return { ok: false, error: "You do not have permission to manage test sets." };
  }
  const parsed = testSetUpdateInput.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const testSet = await testSetInActiveWorkspace(parsed.data.id);
  if (!testSet) return { ok: false, error: "Test set not found in this workspace." };

  await prisma.testSet.update({
    where: { id: parsed.data.id },
    data: { name: parsed.data.name, description: parsed.data.description },
  });
  revalidate(testSet.projectId);
  return { ok: true };
}

export async function deleteTestSet(formData: FormData): Promise<void> {
  if (!(await requirePermission(PERMISSIONS.CASE_MANAGE))) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const testSet = await testSetInActiveWorkspace(id);
  if (!testSet) return;

  await prisma.testSet.delete({ where: { id } });
  revalidate(testSet.projectId);
}

export async function addCaseToTestSet(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requirePermission(PERMISSIONS.CASE_MANAGE))) {
    return { ok: false, error: "You do not have permission to manage test sets." };
  }
  const parsed = testSetItemInput.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const { testSetId, testCaseId } = parsed.data;
  const testSet = await testSetInActiveWorkspace(testSetId);
  if (!testSet) return { ok: false, error: "Test set not found in this workspace." };

  const testCase = await prisma.testCase.findUnique({
    where: { id: testCaseId },
    select: { projectId: true },
  });
  if (!testCase || testCase.projectId !== testSet.projectId) {
    return { ok: false, error: "Test case not found in this project." };
  }

  const last = await prisma.testSetItem.aggregate({
    where: { testSetId },
    _max: { order: true },
  });

  await prisma.testSetItem.upsert({
    where: { testSetId_testCaseId: { testSetId, testCaseId } },
    create: { testSetId, testCaseId, order: (last._max.order ?? -1) + 1 },
    update: {},
  });
  revalidate(testSet.projectId);
  return { ok: true };
}

export async function removeCaseFromTestSet(formData: FormData): Promise<void> {
  if (!(await requirePermission(PERMISSIONS.CASE_MANAGE))) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const item = await prisma.testSetItem.findUnique({
    where: { id },
    select: { testSet: { select: { projectId: true } } },
  });
  if (!item || !(await projectInActiveWorkspace(item.testSet.projectId))) return;

  await prisma.testSetItem.delete({ where: { id } });
  revalidate(item.testSet.projectId);
}
