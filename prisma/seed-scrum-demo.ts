import { ALL_PERMISSIONS } from "../src/lib/permissions";
import { prisma } from "./script-client";

const WORKSPACE_NAME = "SCRUM (Jira demo)";
const PROJECT_KEY = "SCRUM";
const ADMIN_EMAIL = "admin@testhub.dev";

type SeedCase = {
  title: string;
  suite: string;
  issueKey: string;
  issueType: string;
  issueSummary: string;
  status: "PASSED" | "FAILED" | null;
};

const CASES: SeedCase[] = [
  {
    title: "Sign in with valid credentials",
    suite: "Authentication",
    issueKey: "SCRUM-1",
    issueType: "Story",
    issueSummary: "As a user I can sign in",
    status: "PASSED",
  },
  {
    title: "Sign in rejects an invalid password",
    suite: "Authentication",
    issueKey: "SCRUM-2",
    issueType: "Story",
    issueSummary: "As a user I am told when my password is wrong",
    status: "PASSED",
  },
  {
    title: "Password reset email is delivered",
    suite: "Authentication",
    issueKey: "SCRUM-3",
    issueType: "Bug",
    issueSummary: "Password reset email is not delivered",
    status: "FAILED",
  },
  {
    title: "Board loads within two seconds",
    suite: "Dashboard",
    issueKey: "SCRUM-4",
    issueType: "Story",
    issueSummary: "As a user the board loads quickly",
    status: "PASSED",
  },
  {
    title: "Sprint filter updates the board",
    suite: "Dashboard",
    issueKey: "SCRUM-5",
    issueType: "Story",
    issueSummary: "As a user I can filter the board by sprint",
    status: null,
  },
  {
    title: "Card drag and drop updates status",
    suite: "Dashboard",
    issueKey: "SCRUM-6",
    issueType: "Story",
    issueSummary: "As a user I can drag cards between columns",
    status: null,
  },
];

async function main() {
  const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!admin) {
    throw new Error(`Admin ${ADMIN_EMAIL} not found. Run "npm run db:seed" first.`);
  }

  let workspace = await prisma.workspace.findFirst({
    where: { name: WORKSPACE_NAME },
  });
  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: { name: WORKSPACE_NAME },
    });
    console.log(`Created workspace "${WORKSPACE_NAME}".`);
  } else {
    console.log(`Workspace "${WORKSPACE_NAME}" already exists.`);
  }

  const owner = await prisma.role.upsert({
    where: { workspaceId_name: { workspaceId: workspace.id, name: "Owner" } },
    create: {
      workspaceId: workspace.id,
      name: "Owner",
      description: "Full access to this workspace",
      permissions: ALL_PERMISSIONS.join(", "),
    },
    update: {},
  });

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: { workspaceId: workspace.id, userId: admin.id },
    },
    create: { workspaceId: workspace.id, userId: admin.id, roleId: owner.id },
    update: { roleId: owner.id },
  });

  const existing = await prisma.project.findFirst({
    where: { workspaceId: workspace.id, key: PROJECT_KEY },
  });
  if (existing) {
    console.log(
      `Project ${PROJECT_KEY} already exists in this workspace — nothing to seed.`,
    );
    return;
  }

  const project = await prisma.project.create({
    data: {
      workspaceId: workspace.id,
      key: PROJECT_KEY,
      name: "SCRUM board demo",
      description:
        "Demo project linked to a Jira Cloud SCRUM board to show the integration.",
      createdById: admin.id,
    },
  });

  const suiteIds = new Map<string, string>();
  for (const [index, name] of ["Authentication", "Dashboard"].entries()) {
    const suite = await prisma.testSuite.create({
      data: { projectId: project.id, name, order: index },
    });
    suiteIds.set(name, suite.id);
  }

  const run = await prisma.testRun.create({
    data: {
      projectId: project.id,
      name: "SCRUM demo run",
      description: "Sample execution for the Jira integration demo.",
      environment: "Staging",
      createdById: admin.id,
    },
  });

  for (const [index, seed] of CASES.entries()) {
    const testCase = await prisma.testCase.create({
      data: {
        projectId: project.id,
        suiteId: suiteIds.get(seed.suite) ?? null,
        number: index + 1,
        title: seed.title,
        preconditions: "The application is deployed and reachable.",
        priority: "HIGH",
        createdById: admin.id,
        steps: {
          create: [
            {
              order: 0,
              action: "Open the board and sign in",
              expectedResult: "The board is displayed",
            },
            {
              order: 1,
              action: seed.title,
              expectedResult: "The expected behaviour is observed",
            },
          ],
        },
        jiraLinks: {
          create: {
            issueKey: seed.issueKey,
            summary: seed.issueSummary,
            issueType: seed.issueType,
            projectKey: PROJECT_KEY,
          },
        },
      },
    });

    await prisma.testRunItem.create({
      data: { runId: run.id, testCaseId: testCase.id, order: index },
    });

    if (seed.status) {
      await prisma.testExecution.create({
        data: {
          projectId: project.id,
          testCaseId: testCase.id,
          runId: run.id,
          status: seed.status,
          comment:
            seed.status === "FAILED"
              ? "The reset email never arrived within 10 minutes."
              : null,
          executedById: admin.id,
        },
      });
    }
  }

  console.log(
    `Seeded project ${PROJECT_KEY} with ${CASES.length} cases (3 passed, 1 failed, 2 untested).`,
  );
  console.log(
    `Switch to the "${WORKSPACE_NAME}" workspace from the sidebar switcher.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
