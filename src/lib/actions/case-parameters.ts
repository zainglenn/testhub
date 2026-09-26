"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { requirePermission } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { caseInActiveWorkspace } from "@/lib/workspace";

export async function setCaseParameters(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requirePermission(PERMISSIONS.CASE_MANAGE))) {
    return { ok: false, error: "You do not have permission to manage test cases." };
  }

  const testCaseId = String(formData.get("testCaseId") ?? "");
  const testCase = testCaseId ? await caseInActiveWorkspace(testCaseId) : null;
  if (!testCase) {
    return { ok: false, error: "Test case not found in this workspace." };
  }

  const parameterIds = Array.from(
    new Set(formData.getAll("parameterId").map(String).filter(Boolean)),
  );

  await prisma.$transaction([
    prisma.testCaseParameter.deleteMany({ where: { testCaseId } }),
    ...(parameterIds.length
      ? [
          prisma.testCaseParameter.createMany({
            data: parameterIds.map((parameterId) => ({ testCaseId, parameterId })),
          }),
        ]
      : []),
  ]);

  revalidatePath(`/projects/${testCase.projectId}/cases`);
  return { ok: true };
}
