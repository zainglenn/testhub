import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const WORKSPACE_NAME = "Default Workspace";
export const WORKSPACE_COOKIE = "workspace_id";

/**
 * Resolves the workspace for the current request. When a user is signed in we
 * use the workspace selected via the `workspace_id` cookie (validated against
 * their memberships); otherwise we fall back to their first membership.
 */
export async function getWorkspace() {
  const session = await getSession().catch(() => null);

  if (session) {
    const store = await cookies();
    const requestedId = store.get(WORKSPACE_COOKIE)?.value;

    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: session.userId },
      include: { workspace: true },
      orderBy: { createdAt: "asc" },
    });

    if (memberships.length > 0) {
      const active =
        (requestedId &&
          memberships.find((member) => member.workspaceId === requestedId)) ||
        memberships[0];
      return active.workspace;
    }

    // First sign-in: give the user their own workspace.
    return prisma.workspace.create({
      data: {
        name: WORKSPACE_NAME,
        members: { create: { userId: session.userId } },
      },
    });
  }

  const existing = await prisma.workspace.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;

  return prisma.workspace.create({ data: { name: WORKSPACE_NAME } });
}

export async function listWorkspaces() {
  const session = await getSession();
  if (!session) return [];
  return prisma.workspaceMember.findMany({
    where: { userId: session.userId },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });
}

/** Loads a project only if it belongs to the active workspace. */
export async function getScopedProject(id: string) {
  const workspace = await getWorkspace();
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return null;
  if (project.workspaceId && project.workspaceId !== workspace.id) return null;
  return project;
}

/** True when the project exists and belongs to the active workspace. */
export async function projectInActiveWorkspace(projectId: string) {
  if (!projectId) return false;
  const workspace = await getWorkspace();
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { workspaceId: true },
  });
  if (!project) return false;
  return !project.workspaceId || project.workspaceId === workspace.id;
}

/** Loads a test case only if its project belongs to the active workspace. */
export async function caseInActiveWorkspace(id: string) {
  if (!id) return null;
  const testCase = await prisma.testCase.findUnique({
    where: { id },
    select: { projectId: true },
  });
  if (!testCase) return null;
  return (await projectInActiveWorkspace(testCase.projectId)) ? testCase : null;
}

/** Loads a test step only if its case's project belongs to the active workspace. */
export async function stepInActiveWorkspace(id: string) {
  if (!id) return null;
  const step = await prisma.testStep.findUnique({
    where: { id },
    select: { testCaseId: true, testCase: { select: { projectId: true } } },
  });
  if (!step) return null;
  return (await projectInActiveWorkspace(step.testCase.projectId)) ? step : null;
}

/** Loads a suite only if its project belongs to the active workspace. */
export async function suiteInActiveWorkspace(id: string) {
  if (!id) return null;
  const suite = await prisma.testSuite.findUnique({
    where: { id },
    select: { id: true, projectId: true, parentId: true, order: true },
  });
  if (!suite) return null;
  return (await projectInActiveWorkspace(suite.projectId)) ? suite : null;
}

/** Loads a run only if its project belongs to the active workspace. */
export async function runInActiveWorkspace(id: string) {
  if (!id) return null;
  const run = await prisma.testRun.findUnique({
    where: { id },
    select: { id: true, projectId: true },
  });
  if (!run) return null;
  return (await projectInActiveWorkspace(run.projectId)) ? run : null;
}

/** Loads a tag only if its project belongs to the active workspace. */
export async function tagInActiveWorkspace(id: string) {
  if (!id) return null;
  const tag = await prisma.tag.findUnique({
    where: { id },
    select: { id: true, projectId: true },
  });
  if (!tag) return null;
  return (await projectInActiveWorkspace(tag.projectId)) ? tag : null;
}

/** Loads an API token only if its project belongs to the active workspace. */
export async function tokenInActiveWorkspace(id: string) {
  if (!id) return null;
  const token = await prisma.apiToken.findUnique({
    where: { id },
    select: { id: true, projectId: true },
  });
  if (!token) return null;
  return (await projectInActiveWorkspace(token.projectId)) ? token : null;
}
