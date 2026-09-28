"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/authz";
import { CASE_STATUSES, PRIORITIES } from "@/lib/constants";
import { parseCsv } from "@/lib/csv";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  firstError,
  formToObject,
  testCaseInput,
  testCaseUpdateInput,
  testStepInput,
  testStepUpdateInput,
} from "@/lib/validation";
import {
  caseInActiveWorkspace,
  getWorkspace,
  projectInActiveWorkspace,
} from "@/lib/workspace";

function normalizeOptionalId(value: unknown): unknown {
  return value === "" || value === "none" ? null : value;
}

const PRIORITY_SET = new Set<string>(PRIORITIES);
const STATUS_SET = new Set<string>(CASE_STATUSES);

function parseSteps(raw: string) {
  if (!raw.trim()) return [];
  return raw
    .split(" | ")
    .map((part) => {
      const [action, expected] = part.split("=>");
      return {
        action: (action ?? "").trim(),
        expectedResult: expected ? expected.trim() : null,
      };
    })
    .filter((step) => step.action.length > 0);
}

async function ensureSuitePath(
  projectId: string,
  path: string,
  cache: Map<string, string>,
): Promise<string | null> {
  const segments = path
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length === 0) return null;

  let parentId: string | null = null;
  for (const name of segments) {
    const cacheKey = `${parentId ?? "root"}:${name.toLowerCase()}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      parentId = cached;
      continue;
    }

    const existing: { id: string } | null = await prisma.testSuite.findFirst({
      where: { projectId, parentId, name },
      select: { id: true },
    });

    let suiteId: string | undefined = existing?.id;
    if (!suiteId) {
      const last: { _max: { order: number | null } } =
        await prisma.testSuite.aggregate({
          where: { projectId, parentId },
          _max: { order: true },
        });
      const created: { id: string } = await prisma.testSuite.create({
        data: {
          projectId,
          parentId,
          name,
          order: (last._max.order ?? -1) + 1,
        },
        select: { id: true },
      });
      suiteId = created.id;
    }

    cache.set(cacheKey, suiteId);
    parentId = suiteId;
  }

  return parentId;
}

export async function importCases(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requirePermission(PERMISSIONS.CASE_MANAGE))) {
    return { ok: false, error: "You do not have permission to manage test cases." };
  }
  const projectId = String(formData.get("projectId") ?? "");
  const file = formData.get("file");

  if (!projectId) return { ok: false, error: "Missing project." };
  if (!(await projectInActiveWorkspace(projectId))) {
    return { ok: false, error: "Project not found in this workspace." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a CSV file to import." };
  }
  if (file.size > 2_000_000) {
    return { ok: false, error: "File is too large (max 2 MB)." };
  }

  const rows = parseCsv(await file.text());
  if (rows.length < 2) {
    return {
      ok: false,
      error: "The CSV needs a header row and at least one data row.",
    };
  }

  const header = rows[0].map((cell) => cell.trim().toLowerCase());
  const indexOf = (name: string) => header.indexOf(name);
  const titleIdx = indexOf("title");
  if (titleIdx === -1) {
    return { ok: false, error: "The CSV must include a 'Title' column." };
  }

  const session = await getSession();
  const suiteCache = new Map<string, string>();
  const last = await prisma.testCase.aggregate({
    where: { projectId },
    _max: { number: true },
  });
  let nextNumber = last._max.number ?? 0;
  let created = 0;
  let skipped = 0;

  for (const row of rows.slice(1)) {
    if (row.every((cell) => cell.trim() === "")) continue;

    const title = (row[titleIdx] ?? "").trim();
    if (!title) {
      skipped += 1;
      continue;
    }

    const suiteRaw =
      indexOf("suite") >= 0 ? (row[indexOf("suite")] ?? "").trim() : "";
    const suiteId = suiteRaw
      ? await ensureSuitePath(projectId, suiteRaw, suiteCache)
      : null;

    const priorityRaw = (
      indexOf("priority") >= 0 ? row[indexOf("priority")] : ""
    )
      .trim()
      .toUpperCase();
    const statusRaw = (indexOf("status") >= 0 ? row[indexOf("status")] : "")
      .trim()
      .toUpperCase();
    const steps =
      indexOf("steps") >= 0 ? parseSteps(row[indexOf("steps")] ?? "") : [];
    const tags =
      indexOf("tags") >= 0
        ? (row[indexOf("tags")] ?? "")
            .split(";")
            .map((tag) => tag.trim())
            .filter(Boolean)
        : [];
    const preconditions =
      (indexOf("preconditions") >= 0 ? row[indexOf("preconditions")] : "").trim() ||
      null;
    const description =
      (indexOf("description") >= 0 ? row[indexOf("description")] : "").trim() ||
      null;

    nextNumber += 1;

    await prisma.testCase.create({
      data: {
        projectId,
        suiteId,
        number: nextNumber,
        title,
        description,
        preconditions,
        priority: PRIORITY_SET.has(priorityRaw) ? priorityRaw : "MEDIUM",
        status: STATUS_SET.has(statusRaw) ? statusRaw : "DRAFT",
        createdById: session?.userId ?? null,
        steps: steps.length
          ? {
              create: steps.map((step, index) => ({
                action: step.action,
                expectedResult: step.expectedResult,
                order: index,
              })),
            }
          : undefined,
        tags: tags.length
          ? {
              connectOrCreate: tags.map((name) => ({
                where: {
                  projectId_nameKey: { projectId, nameKey: name.toLowerCase() },
                },
                create: { projectId, name, nameKey: name.toLowerCase() },
              })),
            }
          : undefined,
      },
    });

    created += 1;
  }

  revalidatePath(`/projects/${projectId}/cases`);
  redirect(`/projects/${projectId}/cases?imported=${created}&skipped=${skipped}`);
}

async function revalidateCase(testCaseId: string) {
  const testCase = await prisma.testCase.findUnique({
    where: { id: testCaseId },
    select: { projectId: true },
  });
  if (testCase) {
    revalidatePath(`/projects/${testCase.projectId}/cases`);
  }
}

async function renumberSteps(testCaseId: string) {
  const steps = await prisma.testStep.findMany({
    where: { testCaseId },
    orderBy: { order: "asc" },
  });

  await prisma.$transaction(
    steps.map((step, index) =>
      prisma.testStep.update({
        where: { id: step.id },
        data: { order: index },
      }),
    ),
  );
}

export async function createTestCase(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requirePermission(PERMISSIONS.CASE_MANAGE))) {
    return { ok: false, error: "You do not have permission to manage test cases." };
  }
  const raw = formToObject(formData);
  raw.suiteId = normalizeOptionalId(raw.suiteId);

  const parsed = testCaseInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error) };
  }

  const { projectId, suiteId, title, description, preconditions, priority } =
    parsed.data;

  if (!(await projectInActiveWorkspace(projectId))) {
    return { ok: false, error: "Project not found in this workspace." };
  }

  const session = await getSession();

  const testCase = await prisma.$transaction(async (tx) => {
    const last = await tx.testCase.aggregate({
      where: { projectId },
      _max: { number: true },
    });

    return tx.testCase.create({
      data: {
        projectId,
        suiteId: suiteId ?? null,
        number: (last._max.number ?? 0) + 1,
        title,
        description,
        preconditions,
        priority,
        createdById: session?.userId ?? null,
      },
    });
  });

  revalidatePath(`/projects/${projectId}/cases`);
  redirect(`/projects/${projectId}/cases?modal=${testCase.id}`);
}

export async function updateTestCase(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requirePermission(PERMISSIONS.CASE_MANAGE))) {
    return { ok: false, error: "You do not have permission to manage test cases." };
  }
  const raw = formToObject(formData);
  raw.suiteId = normalizeOptionalId(raw.suiteId);

  const parsed = testCaseUpdateInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error) };
  }

  const { id, projectId, suiteId, title, description, preconditions, priority, status } =
    parsed.data;

  if (!(await caseInActiveWorkspace(id))) {
    return { ok: false, error: "Test case not found in this workspace." };
  }

  await prisma.testCase.update({
    where: { id },
    data: {
      suiteId: suiteId ?? null,
      title,
      description,
      preconditions,
      priority,
      status,
    },
  });

  const fieldValues = new Map<string, string>();
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("field_")) {
      fieldValues.set(key.slice("field_".length), String(value));
    }
  }
  for (const [fieldId, text] of fieldValues) {
    if (text) {
      await prisma.fieldValue.upsert({
        where: { fieldId_testCaseId: { fieldId, testCaseId: id } },
        create: { fieldId, testCaseId: id, value: text },
        update: { value: text },
      });
    } else {
      await prisma.fieldValue.deleteMany({ where: { fieldId, testCaseId: id } });
    }
  }

  revalidatePath(`/projects/${projectId}/cases`);
  return { ok: true };
}

export type BulkCasePatch = {
  suiteId?: string | null;
  priority?: string;
  status?: string;
  addTagId?: string;
  removeTagId?: string;
};

export async function bulkUpdateTestCases(
  ids: string[],
  patch: BulkCasePatch,
): Promise<void> {
  if (!(await requirePermission(PERMISSIONS.CASE_MANAGE))) return;
  if (ids.length === 0) return;

  const targets = await prisma.testCase.findMany({
    where: { id: { in: ids } },
    select: { projectId: true },
  });
  if (targets.length === 0) return;

  const projectIds = new Set(targets.map((testCase) => testCase.projectId));
  for (const projectId of projectIds) {
    if (!(await projectInActiveWorkspace(projectId))) return;
  }

  const data: {
    suiteId?: string | null;
    priority?: string;
    status?: string;
  } = {};
  if (patch.suiteId !== undefined) data.suiteId = patch.suiteId;
  if (patch.priority) data.priority = patch.priority;
  if (patch.status) data.status = patch.status;

  if (Object.keys(data).length > 0) {
    await prisma.testCase.updateMany({ where: { id: { in: ids } }, data });
  }

  if (patch.addTagId) {
    await prisma.$transaction(
      ids.map((id) =>
        prisma.testCase.update({
          where: { id },
          data: { tags: { connect: { id: patch.addTagId } } },
        }),
      ),
    );
  }

  if (patch.removeTagId) {
    await prisma.$transaction(
      ids.map((id) =>
        prisma.testCase.update({
          where: { id },
          data: { tags: { disconnect: { id: patch.removeTagId } } },
        }),
      ),
    );
  }

  revalidatePath(`/projects/${targets[0].projectId}/cases`);
}

export async function deleteTestCases(ids: string[]): Promise<void> {
  if (!(await requirePermission(PERMISSIONS.CASE_MANAGE))) return;
  if (ids.length === 0) return;

  const targets = await prisma.testCase.findMany({
    where: { id: { in: ids } },
    select: { projectId: true },
  });
  if (targets.length === 0) return;

  const projectIds = new Set(targets.map((testCase) => testCase.projectId));
  for (const projectId of projectIds) {
    if (!(await projectInActiveWorkspace(projectId))) return;
  }

  await prisma.testCase.deleteMany({ where: { id: { in: ids } } });

  revalidatePath(`/projects/${targets[0].projectId}/cases`);
  revalidatePath(`/projects/${targets[0].projectId}`);
}

export async function deleteTestCase(formData: FormData): Promise<void> {
  if (!(await requirePermission(PERMISSIONS.CASE_MANAGE))) return;
  const id = String(formData.get("id") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  if (!id) return;

  if (!(await caseInActiveWorkspace(id))) return;

  await prisma.testCase.delete({ where: { id } });

  if (projectId) {
    revalidatePath(`/projects/${projectId}/cases`);
    redirect(`/projects/${projectId}/cases`);
  }
  redirect("/");
}

export async function addStep(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requirePermission(PERMISSIONS.CASE_MANAGE))) {
    return { ok: false, error: "You do not have permission to manage test cases." };
  }
  const parsed = testStepInput.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error) };
  }

  const { testCaseId, action, expectedResult, calledTestCaseId } = parsed.data;

  const testCase = await prisma.testCase.findUnique({
    where: { id: testCaseId },
    select: { projectId: true },
  });
  if (!testCase || !(await projectInActiveWorkspace(testCase.projectId))) {
    return { ok: false, error: "Test case not found in this workspace." };
  }

  let calledId: string | null = null;
  if (calledTestCaseId) {
    if (calledTestCaseId === testCaseId) {
      return { ok: false, error: "A step cannot call its own test case." };
    }
    const called = await prisma.testCase.findFirst({
      where: { id: calledTestCaseId, projectId: testCase.projectId },
      select: { id: true },
    });
    if (!called) {
      return { ok: false, error: "Called test case not found in this project." };
    }
    calledId = called.id;
  }

  const last = await prisma.testStep.aggregate({
    where: { testCaseId },
    _max: { order: true },
  });

  await prisma.testStep.create({
    data: {
      testCaseId,
      action,
      expectedResult,
      calledTestCaseId: calledId,
      order: (last._max.order ?? -1) + 1,
    },
  });

  await revalidateCase(testCaseId);
  return { ok: true };
}

export async function updateStep(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requirePermission(PERMISSIONS.CASE_MANAGE))) {
    return { ok: false, error: "You do not have permission to manage test cases." };
  }
  const parsed = testStepUpdateInput.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error) };
  }

  const { id, testCaseId, action, expectedResult, calledTestCaseId } =
    parsed.data;

  const step = await prisma.testStep.findUnique({
    where: { id },
    select: { testCase: { select: { projectId: true } } },
  });
  if (!step || !(await projectInActiveWorkspace(step.testCase.projectId))) {
    return { ok: false, error: "Test step not found in this workspace." };
  }

  let calledId: string | null = null;
  if (calledTestCaseId) {
    if (calledTestCaseId === testCaseId) {
      return { ok: false, error: "A step cannot call its own test case." };
    }
    const called = await prisma.testCase.findFirst({
      where: { id: calledTestCaseId, projectId: step.testCase.projectId },
      select: { id: true },
    });
    if (!called) {
      return { ok: false, error: "Called test case not found in this project." };
    }
    calledId = called.id;
  }

  await prisma.testStep.update({
    where: { id },
    data: { action, expectedResult, calledTestCaseId: calledId },
  });

  await revalidateCase(testCaseId);
  return { ok: true };
}

export async function deleteStep(formData: FormData): Promise<void> {
  if (!(await requirePermission(PERMISSIONS.CASE_MANAGE))) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const step = await prisma.testStep.findUnique({
    where: { id },
    include: { testCase: { select: { projectId: true } } },
  });
  if (!step) return;
  if (!(await projectInActiveWorkspace(step.testCase.projectId))) return;

  await prisma.testStep.delete({ where: { id } });
  await renumberSteps(step.testCaseId);

  revalidatePath(`/projects/${step.testCase.projectId}/cases`);
}

export async function insertSharedStep(formData: FormData): Promise<void> {
  if (!(await requirePermission(PERMISSIONS.CASE_MANAGE))) return;
  const testCaseId = String(formData.get("testCaseId") ?? "");
  const sharedStepId = String(formData.get("sharedStepId") ?? "");
  if (!testCaseId || !sharedStepId) return;

  const shared = await prisma.sharedStep.findUnique({
    where: { id: sharedStepId },
    include: { items: { orderBy: { order: "asc" } } },
  });
  if (!shared || shared.items.length === 0) return;

  if (!(await caseInActiveWorkspace(testCaseId))) return;
  const workspace = await getWorkspace();
  if (shared.workspaceId !== workspace.id) return;

  const last = await prisma.testStep.aggregate({
    where: { testCaseId },
    _max: { order: true },
  });
  let order = (last._max.order ?? -1) + 1;

  await prisma.testStep.createMany({
    data: shared.items.map((item) => ({
      testCaseId,
      action: item.action,
      expectedResult: item.expectedResult,
      order: order++,
    })),
  });

  await revalidateCase(testCaseId);
}

export async function moveStep(formData: FormData): Promise<void> {
  if (!(await requirePermission(PERMISSIONS.CASE_MANAGE))) return;
  const id = String(formData.get("id") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!id || !["up", "down"].includes(direction)) return;

  const step = await prisma.testStep.findUnique({
    where: { id },
    include: { testCase: { select: { projectId: true } } },
  });
  if (!step) return;

  if (!(await projectInActiveWorkspace(step.testCase.projectId))) return;

  const targetOrder = direction === "up" ? step.order - 1 : step.order + 1;
  const neighbor = await prisma.testStep.findUnique({
    where: { testCaseId_order: { testCaseId: step.testCaseId, order: targetOrder } },
  });
  if (!neighbor) return;

  await prisma.$transaction([
    prisma.testStep.update({ where: { id: step.id }, data: { order: -1 } }),
    prisma.testStep.update({ where: { id: neighbor.id }, data: { order: step.order } }),
    prisma.testStep.update({ where: { id: step.id }, data: { order: targetOrder } }),
  ]);

  revalidatePath(`/projects/${step.testCase.projectId}/cases`);
}
