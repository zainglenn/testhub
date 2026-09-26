import { getSession } from "@/lib/auth";
import { ALL_PERMISSIONS, PERMISSIONS, type Permission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getWorkspace } from "@/lib/workspace";

export async function requireAdmin() {
  return requirePermission(PERMISSIONS.WORKSPACE_MANAGE);
}

export async function effectivePermissions(session: {
  userId: string;
  role: string;
}): Promise<Set<string>> {
  if (session.role === "ADMIN") {
    return new Set(ALL_PERMISSIONS);
  }

  const workspace = await getWorkspace();
  const member = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId: workspace.id, userId: session.userId },
    },
    include: { role: true },
  });

  const permissions = new Set<string>();
  for (const permission of (member?.role?.permissions ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)) {
    permissions.add(permission);
  }
  return permissions;
}

export async function requirePermission(permission: Permission) {
  const session = await getSession();
  if (!session) return null;
  const permissions = await effectivePermissions(session);
  if (!permissions.has(permission)) return null;
  return session;
}
