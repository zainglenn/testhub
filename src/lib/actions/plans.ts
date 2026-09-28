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
  planItemInput,
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

  const { projectId, name, description, testSetId } = parsed.data;
  if (!(await projectInActiveWorkspace(projectId))) {
    return { ok: false, error: "Project not found in this workspace." };
  }

  const session = await getSession();
  const plan = await prisma.testPlan.create({
    data: {
      projectId,
      name,
      description,
      testSetId: testSetId || null,
      createdById: session?.userId ?? null,
    },
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
      testSetId: parsed.data.testSetId || null,
    },
  });
  revalidatePath(`/projects/${plan.projectId}/plans/${parsed.data.id}`);
  revalidatePath(`/projects/${plan.projectId}/plans`);
  return { ok: true };
}

export async function startRunForPlan(formData: FormData): Promise<void> {
  if (!(await requirePermission(PERMISSIONS.RUN_MANAGE))) return;
  const planId = String(formData.get("planId") ?? "");
  if (!planId) return;

  const plan = await prisma.testPlan.findUnique({
    where: { id: planId },
    select: { id: true, name: true, projectId: true, testSetId: true },
  });
  if (!plan || !(await projectInActiveWorkspace(plan.projectId))) return;

  let caseIds: string[] = [];
  const planItems = await prisma.testPlanItem.findMany({
    where: { planId: plan.id },
    orderBy: { order: "asc" },
    select: { testCaseId: true },
  });
  if (planItems.length > 0) {
    caseIds = planItems.map((item) => item.testCaseId);
  } else if (plan.testSetId) {
    const items = await prisma.testSetItem.findMany({
      where: { testSetId: plan.testSetId },
      orderBy: { order: "asc" },
      select: { testCaseId: true },
    });
    caseIds = items.map((item) => item.testCaseId);
  } else {
    const cases = await prisma.testCase.findMany({
      where: { projectId: plan.projectId },
      orderBy: { number: "asc" },
      select: { id: true },
    });
    caseIds = cases.map((testCase) => testCase.id);
  }
  if (caseIds.length === 0) return;

  const session = await getSession();
  const run = await prisma.$transaction(async (tx) => {
    const created = await tx.testRun.create({
      data: {
        projectId: plan.projectId,
        planId: plan.id,
        name: `${plan.name} — run`,
        status: "OPEN",
        createdById: session?.userId ?? null,
      },
    });
    await tx.testRunItem.createMany({
      data: caseIds.map((testCaseId, index) => ({
        runId: created.id,
        testCaseId,
        order: index,
      })),
    });
    return created;
  });

  revalidatePath(`/projects/${plan.projectId}/plans/${plan.id}`);
  redirect(`/projects/${plan.projectId}/runs/${run.id}`);
}

export async function addCaseToPlan(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requirePermission(PERMISSIONS.RUN_MANAGE))) {
    return { ok: false, error: "You do not have permission to manage test plans." };
  }
  const parsed = planItemInput.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const { planId, testCaseId } = parsed.data;
  const plan = await planInActiveWorkspace(planId);
  if (!plan) return { ok: false, error: "Test plan not found in this workspace." };

  const testCase = await prisma.testCase.findUnique({
    where: { id: testCaseId },
    select: { projectId: true },
  });
  if (!testCase || testCase.projectId !== plan.projectId) {
    return { ok: false, error: "Test case not found in this project." };
  }

  const last = await prisma.testPlanItem.aggregate({
    where: { planId },
    _max: { order: true },
  });
  await prisma.testPlanItem.upsert({
    where: { planId_testCaseId: { planId, testCaseId } },
    create: { planId, testCaseId, order: (last._max.order ?? -1) + 1 },
    update: {},
  });

  revalidatePath(`/projects/${plan.projectId}/plans/${planId}`);
  return { ok: true };
}

export async function removeCaseFromPlan(formData: FormData): Promise<void> {
  if (!(await requirePermission(PERMISSIONS.RUN_MANAGE))) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const item = await prisma.testPlanItem.findUnique({
    where: { id },
    select: { planId: true, plan: { select: { projectId: true } } },
  });
  if (!item || !(await projectInActiveWorkspace(item.plan.projectId))) return;

  await prisma.testPlanItem.delete({ where: { id } });
  revalidatePath(`/projects/${item.plan.projectId}/plans/${item.planId}`);
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
