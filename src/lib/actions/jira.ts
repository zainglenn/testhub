"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { requirePermission } from "@/lib/authz";
import {
  createIssue,
  deleteJiraConnection,
  getIssue,
  issueLinkFields,
  updateIssue,
} from "@/lib/jira/client";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { caseInActiveWorkspace } from "@/lib/workspace";

const ISSUE_KEY_PATTERN = /^[A-Z][A-Z0-9_]*-\d+$/;

async function revalidateCaseAndProject(testCaseId: string) {
  const testCase = await prisma.testCase.findUnique({
    where: { id: testCaseId },
    select: { projectId: true },
  });
  if (testCase) {
    revalidatePath(`/projects/${testCase.projectId}/cases`);
  }
}

type MirrorCase = {
  id: string;
  number: number;
  title: string;
  description: string | null;
  preconditions: string | null;
  steps: { action: string; expectedResult: string | null }[];
};

function caseDescriptionLines(
  testCase: MirrorCase,
  project: { id: string; key: string },
): string[] {
  const lines: string[] = [`TestHub test ${project.key}-${testCase.number}`];
  if (testCase.description) lines.push(testCase.description);
  if (testCase.preconditions) {
    lines.push(`Preconditions: ${testCase.preconditions}`);
  }
  testCase.steps.forEach((step, index) => {
    lines.push(
      `${index + 1}. ${step.action}${step.expectedResult ? ` => ${step.expectedResult}` : ""}`,
    );
  });
  const base = (process.env.APP_BASE_URL ?? "").replace(/\/$/, "");
  if (base) {
    lines.push(`TestHub: ${base}/projects/${project.id}/cases?case=${testCase.id}`);
  }
  return lines;
}

const MIRROR_CASE_INCLUDE = {
  project: {
    select: {
      id: true,
      key: true,
      workspaceId: true,
      jiraProjectKey: true,
      jiraTestIssueType: true,
    },
  },
  steps: { orderBy: { order: "asc" as const } },
};

/** Publishes a test case as a Jira issue (the "test mirror"). */
export async function publishCaseToJira(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requirePermission(PERMISSIONS.CASE_MANAGE))) {
    return { ok: false, error: "You do not have permission to edit cases." };
  }
  const id = String(formData.get("testCaseId") ?? "");
  const testCase = await prisma.testCase.findUnique({
    where: { id },
    include: MIRROR_CASE_INCLUDE,
  });
  if (!testCase || !(await caseInActiveWorkspace(testCase.id))) {
    return { ok: false, error: "Test case not found in this workspace." };
  }
  if (!testCase.project.jiraProjectKey) {
    return {
      ok: false,
      error: "Set the Jira project key in project settings first.",
    };
  }
  if (testCase.jiraIssueKey) {
    return {
      ok: false,
      error: `Already published as ${testCase.jiraIssueKey}.`,
    };
  }
  const workspaceId = testCase.project.workspaceId ?? undefined;

  let created;
  try {
    created = await createIssue(
      {
        projectKey: testCase.project.jiraProjectKey,
        issueType: testCase.project.jiraTestIssueType || "Task",
        summary: testCase.title,
        descriptionLines: caseDescriptionLines(testCase, testCase.project),
      },
      workspaceId,
    );
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Failed to create the issue.",
    };
  }

  await prisma.testCase.update({
    where: { id: testCase.id },
    data: { jiraIssueKey: created.key },
  });

  try {
    const issue = await getIssue(created.key, workspaceId);
    await prisma.jiraIssueLink.upsert({
      where: {
        testCaseId_issueKey: { testCaseId: testCase.id, issueKey: created.key },
      },
      create: { testCaseId: testCase.id, ...issueLinkFields(issue) },
      update: issueLinkFields(issue),
    });
  } catch {
    // Metadata is best-effort.
  }

  revalidateCaseAndProject(testCase.id);
  return { ok: true };
}

/** Pushes the latest title/description/steps to the published Jira issue. */
export async function syncCaseToJira(formData: FormData): Promise<void> {
  if (!(await requirePermission(PERMISSIONS.CASE_MANAGE))) return;
  const id = String(formData.get("testCaseId") ?? "");
  const testCase = await prisma.testCase.findUnique({
    where: { id },
    include: MIRROR_CASE_INCLUDE,
  });
  if (!testCase || !testCase.jiraIssueKey) return;
  if (!(await caseInActiveWorkspace(testCase.id))) return;

  try {
    await updateIssue(
      testCase.jiraIssueKey,
      {
        summary: testCase.title,
        descriptionLines: caseDescriptionLines(testCase, testCase.project),
      },
      testCase.project.workspaceId ?? undefined,
    );
  } catch {
    // Leave the mapping in place even if Jira is unreachable.
  }
  revalidateCaseAndProject(testCase.id);
}

/** Detaches the mirror mapping (the Jira issue itself is left in place). */
export async function unpublishCaseFromJira(formData: FormData): Promise<void> {
  if (!(await requirePermission(PERMISSIONS.CASE_MANAGE))) return;
  const id = String(formData.get("testCaseId") ?? "");
  const testCase = await prisma.testCase.findUnique({
    where: { id },
    select: { id: true, jiraIssueKey: true },
  });
  if (!testCase || !(await caseInActiveWorkspace(testCase.id))) return;

  if (testCase.jiraIssueKey) {
    await prisma.jiraIssueLink.deleteMany({
      where: { testCaseId: testCase.id, issueKey: testCase.jiraIssueKey },
    });
  }
  await prisma.testCase.update({
    where: { id: testCase.id },
    data: { jiraIssueKey: null },
  });
  revalidateCaseAndProject(testCase.id);
}

export async function disconnectJira(): Promise<void> {
  await deleteJiraConnection();
  revalidatePath("/");
  redirect("/");
}

export async function linkIssue(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const testCaseId = String(formData.get("testCaseId") ?? "");
  const issueKey = String(formData.get("issueKey") ?? "")
    .trim()
    .toUpperCase();

  if (!testCaseId) {
    return { ok: false, error: "Missing test case" };
  }
  if (!ISSUE_KEY_PATTERN.test(issueKey)) {
    return { ok: false, error: "Enter a valid issue key, e.g. PROJ-123" };
  }
  if (!(await caseInActiveWorkspace(testCaseId))) {
    return { ok: false, error: "Test case not found in this workspace." };
  }

  try {
    const issue = await getIssue(issueKey);
    const fields = issueLinkFields(issue);

    await prisma.jiraIssueLink.upsert({
      where: { testCaseId_issueKey: { testCaseId, issueKey } },
      create: { testCaseId, ...fields },
      update: fields,
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to link issue",
    };
  }

  await revalidateCaseAndProject(testCaseId);
  return { ok: true };
}

export async function unlinkIssue(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const testCaseId = String(formData.get("testCaseId") ?? "");
  if (!id) return;

  const link = await prisma.jiraIssueLink.findUnique({
    where: { id },
    select: { testCaseId: true },
  });
  if (!link || !(await caseInActiveWorkspace(link.testCaseId))) return;

  await prisma.jiraIssueLink.delete({ where: { id } });

  if (testCaseId) {
    await revalidateCaseAndProject(testCaseId);
  }
}

async function refreshLinkById(id: string): Promise<void> {
  const link = await prisma.jiraIssueLink.findUnique({ where: { id } });
  if (!link) return;

  const issue = await getIssue(link.issueKey);
  const fields = issueLinkFields(issue);

  await prisma.jiraIssueLink.update({
    where: { id },
    data: fields,
  });
}

export async function refreshIssueLink(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const testCaseId = String(formData.get("testCaseId") ?? "");
  if (!id) return;

  const link = await prisma.jiraIssueLink.findUnique({
    where: { id },
    select: { testCaseId: true },
  });
  if (!link || !(await caseInActiveWorkspace(link.testCaseId))) return;

  try {
    await refreshLinkById(id);
  } catch {
    // Keep the last known metadata when Jira cannot be reached.
  }

  if (testCaseId) {
    await revalidateCaseAndProject(testCaseId);
  }
}

export async function refreshCaseLinks(formData: FormData): Promise<void> {
  const testCaseId = String(formData.get("testCaseId") ?? "");
  if (!testCaseId) return;

  if (!(await caseInActiveWorkspace(testCaseId))) return;

  const links = await prisma.jiraIssueLink.findMany({ where: { testCaseId } });

  await Promise.allSettled(links.map((link) => refreshLinkById(link.id)));

  await revalidateCaseAndProject(testCaseId);
}

export async function createBugFromCase(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requirePermission(PERMISSIONS.CASE_MANAGE))) {
    return { ok: false, error: "You do not have permission to manage test cases." };
  }

  const testCaseId = String(formData.get("testCaseId") ?? "");
  const projectKey = String(formData.get("projectKey") ?? "")
    .trim()
    .toUpperCase();
  const issueType =
    String(formData.get("issueType") ?? "").trim() || "Bug";
  const summary = String(formData.get("summary") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!testCaseId) return { ok: false, error: "Missing test case." };
  if (!projectKey) return { ok: false, error: "Enter a Jira project key." };
  if (summary.length < 3) return { ok: false, error: "Enter a summary." };

  if (!(await caseInActiveWorkspace(testCaseId))) {
    return { ok: false, error: "Test case not found in this workspace." };
  }

  try {
    const issue = await createIssue({
      projectKey,
      issueType,
      summary,
      descriptionLines: description ? [description] : undefined,
    });

    const full = await getIssue(issue.key);
    const fields = issueLinkFields(full);

    await prisma.jiraIssueLink.upsert({
      where: { testCaseId_issueKey: { testCaseId, issueKey: issue.key } },
      create: { testCaseId, ...fields },
      update: fields,
    });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Failed to create the Jira bug.",
    };
  }

  await revalidateCaseAndProject(testCaseId);
  return { ok: true };
}
