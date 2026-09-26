import crypto from "node:crypto";
import { hashPassword } from "../src/lib/password";
import { prisma } from "./script-client";

async function main() {
  await ensureAdminUser();
  await seedWorkspace();
  console.log("Seed complete.");
}

async function ensureAdminUser(): Promise<string> {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@testhub.dev";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== "ADMIN") {
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: "ADMIN" },
      });
    }
    return existing.id;
  }

  const generated = !process.env.SEED_ADMIN_PASSWORD;
  const password =
    process.env.SEED_ADMIN_PASSWORD ?? crypto.randomBytes(18).toString("base64url");

  const user = await prisma.user.create({
    data: {
      email,
      name: "Administrator",
      passwordHash: hashPassword(password),
      role: "ADMIN",
    },
  });

  console.log(`Created admin ${email}.`);
  if (generated) {
    console.log(
      `Generated admin password (store it now, it is not shown again): ${password}`,
    );
  }
  return user.id;
}

async function seedWorkspace() {
  let workspace = await prisma.workspace.findFirst();
  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: { name: "Default Workspace" },
    });
    console.log("Created default workspace.");
  }

  const users = await prisma.user.findMany({ select: { id: true } });
  for (const user of users) {
    await prisma.workspaceMember.upsert({
      where: {
        workspaceId_userId: { workspaceId: workspace.id, userId: user.id },
      },
      create: { workspaceId: workspace.id, userId: user.id },
      update: {},
    });
  }

  const adminRole = await prisma.role.upsert({
    where: {
      workspaceId_name: { workspaceId: workspace.id, name: "Administrator" },
    },
    create: {
      workspaceId: workspace.id,
      name: "Administrator",
      description: "Full access to the workspace",
      permissions: "workspace.manage,project.manage,case.manage,run.manage",
    },
    update: {},
  });
  const memberRole = await prisma.role.upsert({
    where: { workspaceId_name: { workspaceId: workspace.id, name: "Member" } },
    create: {
      workspaceId: workspace.id,
      name: "Member",
      description: "Standard access",
      permissions: "case.manage,run.manage",
    },
    update: {},
  });

  const accounts = await prisma.user.findMany({
    select: { id: true, role: true },
  });
  for (const account of accounts) {
    await prisma.workspaceMember.updateMany({
      where: { workspaceId: workspace.id, userId: account.id, roleId: null },
      data: {
        roleId: account.role === "ADMIN" ? adminRole.id : memberRole.id,
      },
    });
  }

  if ((await prisma.field.count({ where: { workspaceId: workspace.id } })) === 0) {
    await prisma.field.createMany({
      data: [
        {
          workspaceId: workspace.id,
          name: "Severity",
          type: "SELECT",
          entity: "CASE",
          options: "Minor,Major,Critical",
          order: 0,
        },
        {
          workspaceId: workspace.id,
          name: "Automated",
          type: "CHECKBOX",
          entity: "CASE",
          order: 1,
        },
      ],
    });
  }

  if (
    (await prisma.parameter.count({ where: { workspaceId: workspace.id } })) === 0
  ) {
    await prisma.parameter.create({
      data: {
        workspaceId: workspace.id,
        name: "Browser",
        values: "Chrome,Firefox,WebKit",
      },
    });
  }

  if (
    (await prisma.sharedStep.count({ where: { workspaceId: workspace.id } })) === 0
  ) {
    const shared = await prisma.sharedStep.create({
      data: { workspaceId: workspace.id, title: "Sign in to the admin console" },
    });
    await prisma.sharedStepItem.createMany({
      data: [
        {
          sharedStepId: shared.id,
          order: 0,
          action: "Open the EPP server",
          expectedResult: "The login page is displayed",
        },
        {
          sharedStepId: shared.id,
          order: 1,
          action: "Log in and accept the EULA",
          expectedResult: "The dashboard is displayed",
        },
      ],
    });
  }

  await prisma.ssoConfig.upsert({
    where: { workspaceId: workspace.id },
    create: { workspaceId: workspace.id },
    update: {},
  });

  console.log("Workspace ready.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
