"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/authz";
import { isExecutionStatus } from "@/lib/constants";
import { commentCaseResult, commentRunSummary } from "@/lib/jira/sync";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { firstError, formToObject, runInput } from "@/lib/validation";
import { projectInActiveWorkspace, runInActiveWorkspace } from "@/lib/workspace";

function normalizeOptionalId(value: unknown): unknown {
  return value === "" || value === "none" ? null : value;
}

function collectDescendants(
  suites: { id: string; parentId: string | null }[],
  rootId: string,
): string[] {
  const ids = new Set<string>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const suite of suites) {
      if (
        suite.parentId &&
        ids.has(suite.parentId) &&
        !ids.has(suite.id)
      ) {
        ids.add(suite.id);
        changed = true;
      }
    }
  }
  return Array.from(ids);
}

export async function createTestRun(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requirePermission(PERMISSIONS.RUN_MANAGE))) {
    return { ok: false, error: "You do not have permission to manage runs." };
  }
  const raw = formToObject(formData);
  raw.suiteId = normalizeOptionalId(raw.suiteId);
  raw.tagId = normalizeOptionalId(raw.tagId);

  const parsed = runInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error) };
  }

  const { projectId, name, description, environment, scope, suiteId, tagId } =
    parsed.data;

  if (!(await projectInActiveWorkspace(projectId))) {
    return { ok: false, error: "Project not found in this workspace." };
  }

  let caseIds: string[] = [];

  if (scope === "SUITE" && suiteId) {
    const suites = await prisma.testSuite.findMany({
      where: { projectId },
      select: { id: true, parentId: true },
    });
    const suiteIds = collectDescendants(suites, suiteId);
    const cases = await prisma.testCase.findMany({
      where: { projectId, suiteId: { in: suiteIds } },
      orderBy: { number: "asc" },
      select: { id: true },
    });
    caseIds = cases.map((testCase) => testCase.id);
  } else if (scope === "TAG" && tagId) {
    const cases = await prisma.testCase.findMany({
      where: { projectId, tags: { some: { id: tagId } } },
      orderBy: { number: "asc" },
      select: { id: true },
    });
    caseIds = cases.map((testCase) => testCase.id);
  } else {
    const cases = await prisma.testCase.findMany({
      where: { projectId },
      orderBy: { number: "asc" },
      select: { id: true },
    });
    caseIds = cases.map((testCase) => testCase.id);
  }

  if (caseIds.length === 0) {
    return { ok: false, error: "No test cases match this scope." };
  }

  const session = await getSession();

  const run = await prisma.$transaction(async (tx) => {
    const created = await tx.testRun.create({
      data: {
        projectId,
        name,
        description,
        environment,
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

  revalidatePath(`/projects/${projectId}/runs`);
  redirect(`/projects/${projectId}/runs/${run.id}`);
}

export async function setRunResult(
  runId: string,
  testCaseId: string,
  status: string,
): Promise<void> {
  if (!(await requirePermission(PERMISSIONS.RUN_MANAGE))) return;
  if (!isExecutionStatus(status)) return;

  const run = await prisma.testRun.findUnique({
    where: { id: runId },
    select: { projectId: true, status: true, name: true },
  });
  if (!run || run.status === "COMPLETED") return;
  if (!(await projectInActiveWorkspace(run.projectId))) return;

  const executedAt = new Date();
  const session = await getSession();

  await prisma.testExecution.upsert({
    where: { runId_testCaseId: { runId, testCaseId } },
    create: {
      runId,
      testCaseId,
      projectId: run.projectId,
      status,
      executedAt,
      executedById: session?.userId ?? null,
    },
    update: {
      status,
      executedAt,
      executedById: session?.userId ?? null,
    },
  });

  await commentCaseResult(testCaseId, status, `Run "${run.name}"`);

  revalidatePath(`/projects/${run.projectId}/runs/${runId}`);
  revalidatePath(`/projects/${run.projectId}/reports`);
  revalidatePath(`/projects/${run.projectId}`);
  revalidatePath("/");
}

export async function clearRunResult(
  runId: string,
  testCaseId: string,
): Promise<void> {
  if (!(await requirePermission(PERMISSIONS.RUN_MANAGE))) return;
  const run = await prisma.testRun.findUnique({
    where: { id: runId },
    select: { projectId: true, status: true },
  });
  if (!run || run.status === "COMPLETED") return;
  if (!(await projectInActiveWorkspace(run.projectId))) return;

  await prisma.testExecution.deleteMany({ where: { runId, testCaseId } });

  revalidatePath(`/projects/${run.projectId}/runs/${runId}`);
  revalidatePath(`/projects/${run.projectId}/reports`);
  revalidatePath(`/projects/${run.projectId}`);
  revalidatePath("/");
}

export async function completeTestRun(formData: FormData): Promise<void> {
  if (!(await requirePermission(PERMISSIONS.RUN_MANAGE))) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  if (!(await runInActiveWorkspace(id))) return;

  const run = await prisma.testRun.update({
    where: { id },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  await commentRunSummary(id);

  revalidatePath(`/projects/${run.projectId}/runs/${id}`);
  revalidatePath(`/projects/${run.projectId}/reports`);
  revalidatePath(`/projects/${run.projectId}`);
}

export async function reopenTestRun(formData: FormData): Promise<void> {
  if (!(await requirePermission(PERMISSIONS.RUN_MANAGE))) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  if (!(await runInActiveWorkspace(id))) return;

  const run = await prisma.testRun.update({
    where: { id },
    data: { status: "OPEN", completedAt: null },
  });

  revalidatePath(`/projects/${run.projectId}/runs/${id}`);
  revalidatePath(`/projects/${run.projectId}/reports`);
  revalidatePath(`/projects/${run.projectId}`);
}

export async function deleteTestRun(formData: FormData): Promise<void> {
  if (!(await requirePermission(PERMISSIONS.RUN_MANAGE))) return;
  const id = String(formData.get("id") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  if (!id) return;

  if (!(await runInActiveWorkspace(id))) return;

  await prisma.testRun.delete({ where: { id } });

  if (projectId) {
    revalidatePath(`/projects/${projectId}/runs`);
    redirect(`/projects/${projectId}/runs`);
  }
  redirect("/");
}
