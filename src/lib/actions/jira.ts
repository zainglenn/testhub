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
