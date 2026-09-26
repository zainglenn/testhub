import { getSession } from "@/lib/auth";
import { effectivePermissions } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export type ProjectAccessContext = {
  userId: string;
  role: string;
  canManageAll: boolean;
};

export async function projectAccessContext(): Promise<ProjectAccessContext | null> {
  const session = await getSession();
  if (!session) return null;
  const permissions = await effectivePermissions(session);
  const canManageAll =
    session.role === "ADMIN" || permissions.has(PERMISSIONS.PROJECT_MANAGE);
  return { userId: session.userId, role: session.role, canManageAll };
}

/** Prisma `where` fragment limiting projects to those the viewer may see. */
export function visibleProjectWhere(userId: string, canManageAll: boolean) {
  if (canManageAll) return {};
  return {
    OR: [{ restricted: false }, { members: { some: { userId } } }],
  };
}

/**
 * True when the project belongs to the given workspace and the signed-in user
 * may see it (admins and project managers see everything; otherwise a
 * restricted project is only visible to its members).
 */
export async function viewerHasProjectAccess(
  project: { id: string; workspaceId: string | null; restricted: boolean },
  workspaceId: string,
): Promise<boolean> {
  if (project.workspaceId && project.workspaceId !== workspaceId) return false;

  const ctx = await projectAccessContext();
  if (!ctx) return false;
  if (!project.restricted || ctx.canManageAll) return true;

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: project.id, userId: ctx.userId } },
    select: { id: true },
  });
  return Boolean(member);
}
