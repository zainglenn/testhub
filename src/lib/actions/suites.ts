"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { requirePermission } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { firstError, formToObject, suiteInput } from "@/lib/validation";
import { projectInActiveWorkspace, suiteInActiveWorkspace } from "@/lib/workspace";

function normalizeOptionalId(value: unknown): unknown {
  return value === "" || value === "none" ? null : value;
}

async function renumberSuites(projectId: string, parentId: string | null) {
  const suites = await prisma.testSuite.findMany({
    where: { projectId, parentId },
    orderBy: { order: "asc" },
  });

  await prisma.$transaction(
    suites.map((suite, index) =>
      prisma.testSuite.update({
        where: { id: suite.id },
        data: { order: index },
      }),
    ),
  );
}

export async function createSuite(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requirePermission(PERMISSIONS.CASE_MANAGE))) {
    return { ok: false, error: "You do not have permission to manage suites." };
  }
  const raw = formToObject(formData);
  raw.parentId = normalizeOptionalId(raw.parentId);

  const parsed = suiteInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error) };
  }

  const { projectId, parentId, name, description } = parsed.data;

  if (!(await projectInActiveWorkspace(projectId))) {
    return { ok: false, error: "Project not found in this workspace." };
  }

  await prisma.$transaction(async (tx) => {
    const last = await tx.testSuite.aggregate({
      where: { projectId, parentId: parentId ?? null },
      _max: { order: true },
    });

    await tx.testSuite.create({
      data: {
        projectId,
        parentId: parentId ?? null,
        name,
        description,
        order: (last._max.order ?? -1) + 1,
      },
    });
  });

  revalidatePath(`/projects/${projectId}/cases`);
  return { ok: true };
}

export async function deleteSuite(formData: FormData): Promise<void> {
  if (!(await requirePermission(PERMISSIONS.CASE_MANAGE))) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const suite = await suiteInActiveWorkspace(id);
  if (!suite) return;

  await prisma.testSuite.delete({ where: { id } });
  await renumberSuites(suite.projectId, suite.parentId);

  revalidatePath(`/projects/${suite.projectId}/cases`);
}

export async function moveSuite(formData: FormData): Promise<void> {
  if (!(await requirePermission(PERMISSIONS.CASE_MANAGE))) return;
  const id = String(formData.get("id") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!id || !["up", "down"].includes(direction)) return;

  const suite = await suiteInActiveWorkspace(id);
  if (!suite) return;

  const sibling = await prisma.testSuite.findMany({
    where: { projectId: suite.projectId, parentId: suite.parentId },
    orderBy: { order: "asc" },
    select: { id: true, order: true },
  });

  const index = sibling.findIndex((item) => item.id === suite.id);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= sibling.length) return;

  const neighbor = sibling[swapIndex];

  await prisma.$transaction([
    prisma.testSuite.update({
      where: { id: suite.id },
      data: { order: neighbor.order },
    }),
    prisma.testSuite.update({
      where: { id: neighbor.id },
      data: { order: suite.order },
    }),
  ]);

  revalidatePath(`/projects/${suite.projectId}/cases`);
}
