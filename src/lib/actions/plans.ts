"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  firstError,
  formToObject,
  planInput,
  planUpdateInput,
} from "@/lib/validation";
import { projectInActiveWorkspace } from "@/lib/workspace";

export async function addRunToPlan(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await setRunPlan(formData);
  return { ok: true };
}

async function planInActiveWorkspace(id: string) {
  const plan = await prisma.testPlan.findUnique({
    where: { id },
    select: { id: true, projectId: true },
  });
  if (!plan) return null;
  return (await projectInActiveWorkspace(plan.projectId)) ? plan : null;
}

export async function createTestPlan(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requirePermission(PERMISSIONS.RUN_MANAGE))) {
    return { ok: false, error: "You do not have permission to manage test plans." };
  }
  const parsed = planInput.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const { projectId, name, description } = parsed.data;
  if (!(await projectInActiveWorkspace(projectId))) {
    return { ok: false, error: "Project not found in this workspace." };
  }

  const session = await getSession();
  const plan = await prisma.testPlan.create({
    data: { projectId, name, description, createdById: session?.userId ?? null },
  });

  revalidatePath(`/projects/${projectId}/plans`);
  redirect(`/projects/${projectId}/plans/${plan.id}`);
}

export async function updateTestPlan(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requirePermission(PERMISSIONS.RUN_MANAGE))) {
    return { ok: false, error: "You do not have permission to manage test plans." };
  }
  const parsed = planUpdateInput.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const plan = await planInActiveWorkspace(parsed.data.id);
  if (!plan) return { ok: false, error: "Test plan not found in this workspace." };

  await prisma.testPlan.update({
    where: { id: parsed.data.id },
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      status: parsed.data.status,
    },
  });
  revalidatePath(`/projects/${plan.projectId}/plans/${parsed.data.id}`);
  revalidatePath(`/projects/${plan.projectId}/plans`);
  return { ok: true };
}

export async function deleteTestPlan(formData: FormData): Promise<void> {
  if (!(await requirePermission(PERMISSIONS.RUN_MANAGE))) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const plan = await planInActiveWorkspace(id);
  if (!plan) return;

  await prisma.testPlan.delete({ where: { id } });
  revalidatePath(`/projects/${plan.projectId}/plans`);
  redirect(`/projects/${plan.projectId}/plans`);
}

export async function setRunPlan(formData: FormData): Promise<void> {
  if (!(await requirePermission(PERMISSIONS.RUN_MANAGE))) return;
  const runId = String(formData.get("runId") ?? "");
  const planId = String(formData.get("planId") ?? "") || null;
  if (!runId) return;

  const run = await prisma.testRun.findUnique({
    where: { id: runId },
    select: { projectId: true },
  });
  if (!run || !(await projectInActiveWorkspace(run.projectId))) return;

  if (planId) {
    const plan = await planInActiveWorkspace(planId);
    if (!plan || plan.projectId !== run.projectId) return;
  }

  await prisma.testRun.update({ where: { id: runId }, data: { planId } });
  revalidatePath(`/projects/${run.projectId}/runs`);
  revalidatePath(`/projects/${run.projectId}/plans`);
  if (planId) revalidatePath(`/projects/${run.projectId}/plans/${planId}`);
}

export async function assignRun(formData: FormData): Promise<void> {
  if (!(await requirePermission(PERMISSIONS.RUN_MANAGE))) return;
  const runId = String(formData.get("runId") ?? "");
  const assigneeId = String(formData.get("assigneeId") ?? "") || null;
  if (!runId) return;

  const run = await prisma.testRun.findUnique({
    where: { id: runId },
    select: { projectId: true },
  });
  if (!run || !(await projectInActiveWorkspace(run.projectId))) return;

  if (assigneeId) {
    const user = await prisma.user.findUnique({
      where: { id: assigneeId },
      select: { id: true },
    });
    if (!user) return;
  }

  await prisma.testRun.update({ where: { id: runId }, data: { assigneeId } });
  revalidatePath(`/projects/${run.projectId}/runs`);
  if (run.projectId) revalidatePath(`/projects/${run.projectId}`);
}
