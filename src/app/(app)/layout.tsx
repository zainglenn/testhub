import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import AppShell from "@/components/app-shell";
import { getSession } from "@/lib/auth";
import { effectivePermissions } from "@/lib/authz";
import { isJiraEnabled } from "@/lib/jira/config";
import { getJiraConnection } from "@/lib/jira/client";
import { prisma } from "@/lib/prisma";
import { getWorkspace, listWorkspaces } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const jiraEnabled = isJiraEnabled();
  const workspace = await getWorkspace();

  const [projects, jira, memberships] = await Promise.all([
    prisma.project
      .findMany({
        where: { workspaceId: workspace.id },
        select: { id: true, key: true, name: true },
        orderBy: { name: "asc" },
      })
      .catch(() => []),
    jiraEnabled ? getJiraConnection().catch(() => null) : Promise.resolve(null),
    listWorkspaces(),
  ]);

  const permissions = Array.from(await effectivePermissions(session));

  return (
    <AppShell
      workspaceName={workspace.name}
      activeWorkspaceId={workspace.id}
      workspaces={memberships.map((member) => ({
        id: member.workspace.id,
        name: member.workspace.name,
      }))}
      permissions={permissions}
      projects={projects}
      jiraEnabled={jiraEnabled}
      jira={
        jira ? { siteName: jira.siteName, siteUrl: jira.siteUrl } : null
      }
      user={{ email: session.email, name: session.name, role: session.role }}
    >
      {children}
    </AppShell>
  );
}
