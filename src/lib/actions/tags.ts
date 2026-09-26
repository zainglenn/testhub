"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { requirePermission } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  firstError,
  formToObject,
  tagInput,
  tagRenameInput,
} from "@/lib/validation";
import { projectInActiveWorkspace, tagInActiveWorkspace } from "@/lib/workspace";

export async function addTagToCase(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requirePermission(PERMISSIONS.CASE_MANAGE))) {
    return { ok: false, error: "You do not have permission to manage tags." };
  }
  const parsed = tagInput.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error) };
  }

  const { testCaseId, name } = parsed.data;

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

  const tag = await prisma.tag.upsert({
    where: {
      projectId_nameKey: {
        projectId: testCase.projectId,
        nameKey: name.toLowerCase(),
      },
    },
    create: {
      projectId: testCase.projectId,
      name,
      nameKey: name.toLowerCase(),
    },
    update: {},
  });

  await prisma.testCase.update({
    where: { id: testCaseId },
    data: { tags: { connect: { id: tag.id } } },
  });

  revalidatePath(`/projects/${testCase.projectId}/cases`);
  return { ok: true };
}

export async function removeTagFromCase(formData: FormData): Promise<void> {
  if (!(await requirePermission(PERMISSIONS.CASE_MANAGE))) return;
  const testCaseId = String(formData.get("testCaseId") ?? "");
  const tagId = String(formData.get("tagId") ?? "");
  if (!testCaseId || !tagId) return;

  const testCase = await prisma.testCase.findUnique({
    where: { id: testCaseId },
    select: { projectId: true },
  });
  if (!testCase || !(await projectInActiveWorkspace(testCase.projectId))) return;
  if (!(await tagInActiveWorkspace(tagId))) return;

  await prisma.testCase.update({
    where: { id: testCaseId },
    data: { tags: { disconnect: { id: tagId } } },
  });

  revalidatePath(`/projects/${testCase.projectId}/cases`);
}

export async function renameTag(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requirePermission(PERMISSIONS.CASE_MANAGE))) {
    return { ok: false, error: "You do not have permission to manage tags." };
  }
  const parsed = tagRenameInput.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error) };
  }

  const { id, name } = parsed.data;
  const nameKey = name.toLowerCase();

  const tag = await prisma.tag.findUnique({
    where: { id },
    select: { projectId: true },
  });
  if (!tag) {
    return { ok: false, error: "Tag not found" };
  }
  if (!(await projectInActiveWorkspace(tag.projectId))) {
    return { ok: false, error: "Tag not found in this workspace." };
  }

  const clash = await prisma.tag.findFirst({
    where: { projectId: tag.projectId, nameKey, NOT: { id } },
    select: { id: true },
  });
  if (clash) {
    return { ok: false, error: `A tag named "${name}" already exists.` };
  }

  await prisma.tag.update({ where: { id }, data: { name, nameKey } });

  revalidatePath(`/projects/${tag.projectId}/settings`);
  revalidatePath(`/projects/${tag.projectId}/cases`);
  return { ok: true };
}

export async function deleteTag(formData: FormData): Promise<void> {
  if (!(await requirePermission(PERMISSIONS.CASE_MANAGE))) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const tag = await tagInActiveWorkspace(id);
  if (!tag) return;

  await prisma.tag.delete({ where: { id } });

  revalidatePath(`/projects/${tag.projectId}/settings`);
  revalidatePath(`/projects/${tag.projectId}/cases`);
}
