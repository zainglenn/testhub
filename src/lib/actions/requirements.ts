"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { requirePermission } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/permissions";
import {
  DEFAULT_REQUIREMENTS_JQL,
  syncProjectRequirements,
} from "@/lib/traceability";
import { projectInActiveWorkspace } from "@/lib/workspace";

export async function syncRequirements(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requirePermission(PERMISSIONS.CASE_MANAGE))) {
    return { ok: false, error: "You do not have permission to sync requirements." };
  }

  const projectId = String(formData.get("projectId") ?? "");
  const jql =
    String(formData.get("jql") ?? "").trim() || DEFAULT_REQUIREMENTS_JQL;

  if (!projectId || !(await projectInActiveWorkspace(projectId))) {
    return { ok: false, error: "Project not found in this workspace." };
  }

  const result = await syncProjectRequirements(projectId, jql);
  if (result.error) return { ok: false, error: result.error };

  revalidatePath(`/projects/${projectId}/traceability`);
  return { ok: true };
}
