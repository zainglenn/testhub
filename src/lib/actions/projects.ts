"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { recordAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  createGlobalIssueType,
  findIssueTypeByName,
  getProjectSummary,
} from "@/lib/jira/client";
import { firstError, formToObject, projectInput, projectJiraInput, projectUpdateInput } from "@/lib/validation";
import { getWorkspace, projectInActiveWorkspace } from "@/lib/workspace";

export async function createProject(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requirePermission(PERMISSIONS.PROJECT_MANAGE))) {
    return { ok: false, error: "You do not have permission to manage projects." };
  }
  const raw = formToObject(formData);
  raw.key = String(raw.key ?? "").trim().toUpperCase();

  const parsed = projectInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error) };
  }

  const { key, name, description } = parsed.data;

  const workspace = await getWorkspace();
  const existing = await prisma.project.findFirst({
    where: { key, workspaceId: workspace.id },
  });
  if (existing) {
    return { ok: false, error: `Project key "${key}" is already in use.` };
  }

  const session = await getSession();
  const project = await prisma.project.create({
    data: {
      key,
      name,
      description,
      workspaceId: workspace.id,
      createdById: session?.userId ?? null,
    },
  });

  await recordAudit({
    workspaceId: workspace.id,
    actorId: session?.userId ?? null,
    action: "project.create",
    entityType: "project",
    entityId: project.id,
  });

  revalidatePath("/");
  redirect(`/projects/${project.id}`);
}

export async function updateProject(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requirePermission(PERMISSIONS.PROJECT_MANAGE))) {
    return { ok: false, error: "You do not have permission to manage projects." };
  }
  const parsed = projectUpdateInput.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error) };
  }

  const { id, name, description } = parsed.data;

  if (!(await projectInActiveWorkspace(id))) {
    return { ok: false, error: "Project not found in this workspace." };
  }

  await prisma.project.update({
    where: { id },
    data: { name, description },
  });

  revalidatePath(`/projects/${id}`);
  revalidatePath("/");
  return { ok: true };
}

export async function updateProjectJira(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requirePermission(PERMISSIONS.PROJECT_MANAGE))) {
    return { ok: false, error: "You do not have permission to manage projects." };
  }
  const parsed = projectJiraInput.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  if (!(await projectInActiveWorkspace(parsed.data.id))) {
    return { ok: false, error: "Project not found in this workspace." };
  }

  await prisma.project.update({
    where: { id: parsed.data.id },
    data: {
      jiraProjectKey: parsed.data.jiraProjectKey
        ? parsed.data.jiraProjectKey.toUpperCase()
        : null,
      jiraTestIssueType: parsed.data.jiraTestIssueType
        ? parsed.data.jiraTestIssueType
        : null,
      jiraPassStatus: parsed.data.jiraPassStatus,
      jiraFailStatus: parsed.data.jiraFailStatus,
    },
  });
  revalidatePath(`/projects/${parsed.data.id}/settings`);
  return { ok: true };
}

/**
 * Best-effort provisioning of a native "Test" work type for a **company-managed**
 * Jira project: creates the issue type if missing and selects it for the project.
 * Team-managed projects must add the work type manually (no public API).
 */
export async function provisionTestWorkType(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requirePermission(PERMISSIONS.PROJECT_MANAGE);
  if (!session) {
    return { ok: false, error: "You do not have permission to manage projects." };
  }
  const projectId = String(formData.get("id") ?? "");
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, workspaceId: true, jiraProjectKey: true },
  });
  if (!project || !(await projectInActiveWorkspace(project.id))) {
    return { ok: false, error: "Project not found in this workspace." };
  }
  if (!project.jiraProjectKey) {
    return { ok: false, error: "Set the Jira project key first." };
  }
  const workspaceId = project.workspaceId ?? undefined;
  if (!workspaceId) {
    return { ok: false, error: "Project is not in a workspace." };
  }

  const jiraProject = await getProjectSummary(project.jiraProjectKey, workspaceId);
  if (!jiraProject) {
    return { ok: false, error: "Jira project not found — check the project key." };
  }
  if (jiraProject.simplified) {
    return {
      ok: false,
      error:
        'This is a team-managed project: add a "Test" work type in Space settings → Work types, then select it above. (Auto-provisioning needs a company-managed project.)',
    };
  }

  try {
    const existing = await findIssueTypeByName("Test", workspaceId);
    if (!existing) {
      await createGlobalIssueType("Test", "TestHub test case", workspaceId);
    }
    await prisma.project.update({
      where: { id: project.id },
      data: { jiraTestIssueType: "Test" },
    });
    await recordAudit({
      workspaceId,
      actorId: session.userId,
      action: "jira.provision",
      entityType: "project",
      entityId: project.id,
      metadata: { issueType: "Test", created: !existing },
    });
    revalidatePath(`/projects/${project.id}/settings`);
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Provisioning failed.";
    if (/\(403\)/.test(message) || /scope/i.test(message)) {
      return {
        ok: false,
        error:
          "Reconnect Jira to grant the manage:jira-configuration scope, then retry.",
      };
    }
    return { ok: false, error: message };
  }
}

export async function deleteProject(formData: FormData): Promise<void> {
  if (!(await requirePermission(PERMISSIONS.PROJECT_MANAGE))) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  if (!(await projectInActiveWorkspace(id))) return;

  const session = await getSession();
  await prisma.project.delete({ where: { id } });

  const workspace = await getWorkspace();
  await recordAudit({
    workspaceId: workspace.id,
    actorId: session?.userId ?? null,
    action: "project.delete",
    entityType: "project",
    entityId: id,
  });

  revalidatePath("/");
  revalidatePath("/projects");
  redirect("/projects");
}
