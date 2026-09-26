import { ALL_PERMISSIONS } from "../src/lib/permissions";
import { prisma } from "./script-client";

const WORKSPACE_NAME = "SCRUM (Jira demo)";
const PROJECT_KEY = "SCRUM";
const ADMIN_EMAIL = "admin@testhub.dev";

const SUITES = ["Authentication", "Account", "Catalogue", "Cart & Checkout", "Platform"];

// Real Jira issue keys (project SCRUM) that the demo cases trace to.
const ISSUES: Record<string, { type: string; summary: string }> = {
  "SCRUM-5": { type: "Story", summary: "As a customer I can sign in with email and password" },
  "SCRUM-6": { type: "Story", summary: "As a customer I can reset my password by email" },
  "SCRUM-7": { type: "Story", summary: "As a customer I can update my profile details" },
  "SCRUM-8": { type: "Story", summary: "As a customer I can view my order history" },
  "SCRUM-9": { type: "Story", summary: "As a customer I can search products" },
  "SCRUM-10": { type: "Story", summary: "As a customer I can filter products by category" },
  "SCRUM-11": { type: "Story", summary: "As a customer I can add items to the cart" },
  "SCRUM-12": { type: "Story", summary: "As a customer I can apply a discount code" },
  "SCRUM-13": { type: "Story", summary: "As a customer I can check out with a saved card" },
  "SCRUM-14": { type: "Task", summary: "Set up an end-to-end test pipeline in CI" },
  "SCRUM-15": { type: "Bug", summary: "Password reset email is not delivered" },
  "SCRUM-16": { type: "Bug", summary: "Search returns duplicate results" },
  "SCRUM-17": { type: "Bug", summary: "Cart total is incorrect when a discount is applied" },
};

type SeedCase = {
  title: string;
  suite: string;
  priority: "HIGH" | "MEDIUM";
  status: "PASS" | "FAIL" | null;
  links: string[];
  comment?: string;
};

const CASES: SeedCase[] = [
  { title: "Sign in with a valid email and password", suite: "Authentication", priority: "HIGH", status: "PASS", links: ["SCRUM-5"] },
  { title: "Sign in is rejected with an invalid password", suite: "Authentication", priority: "HIGH", status: "PASS", links: ["SCRUM-5"] },
  { title: "Password reset email is delivered", suite: "Authentication", priority: "HIGH", status: "FAIL", links: ["SCRUM-6", "SCRUM-15"], comment: "No email arrived within 10 minutes; reproduced across two providers." },
  { title: "Password reset link expires after 30 minutes", suite: "Authentication", priority: "MEDIUM", status: "PASS", links: ["SCRUM-6"] },
  { title: "Update profile name and email", suite: "Account", priority: "MEDIUM", status: "PASS", links: ["SCRUM-7"] },
  { title: "Order history lists the last 10 orders", suite: "Account", priority: "MEDIUM", status: "PASS", links: ["SCRUM-8"] },
  { title: "Search returns relevant products", suite: "Catalogue", priority: "HIGH", status: "PASS", links: ["SCRUM-9"] },
  { title: "Search does not return duplicate products", suite: "Catalogue", priority: "MEDIUM", status: "FAIL", links: ["SCRUM-9", "SCRUM-16"], comment: "The same product is listed twice on page 2." },
  { title: "Filter products by category", suite: "Catalogue", priority: "MEDIUM", status: "PASS", links: ["SCRUM-10"] },
  { title: "Add an item to the cart", suite: "Cart & Checkout", priority: "HIGH", status: "PASS", links: ["SCRUM-11"] },
  { title: "Apply a percentage discount code", suite: "Cart & Checkout", priority: "MEDIUM", status: "PASS", links: ["SCRUM-12"] },
  { title: "Cart total reflects the discount", suite: "Cart & Checkout", priority: "HIGH", status: "FAIL", links: ["SCRUM-12", "SCRUM-17"], comment: "Total shows the undiscounted amount." },
  { title: "Check out with a saved card", suite: "Cart & Checkout", priority: "HIGH", status: "PASS", links: ["SCRUM-13"] },
  { title: "CI pipeline runs the E2E suite on push", suite: "Platform", priority: "MEDIUM", status: null, links: ["SCRUM-14"] },
];

async function main() {
  const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!admin) {
    throw new Error(`Admin ${ADMIN_EMAIL} not found. Run "npm run db:seed" first.`);
  }

  let workspace = await prisma.workspace.findFirst({ where: { name: WORKSPACE_NAME } });
  if (!workspace) {
    workspace = await prisma.workspace.create({ data: { name: WORKSPACE_NAME } });
    console.log(`Created workspace "${WORKSPACE_NAME}".`);
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
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: admin.id } },
    create: { workspaceId: workspace.id, userId: admin.id, roleId: owner.id },
    update: { roleId: owner.id },
  });

  // Rebuild the demo project so re-running is idempotent.
  await prisma.project.deleteMany({ where: { workspaceId: workspace.id, key: PROJECT_KEY } });

  const project = await prisma.project.create({
    data: {
      workspaceId: workspace.id,
      key: PROJECT_KEY,
      name: "Customer Portal",
      description: "Customer portal releases, traced from Jira stories and bugs.",
      createdById: admin.id,
    },
  });

  const suiteIds = new Map<string, string>();
  for (const [index, name] of SUITES.entries()) {
    const suite = await prisma.testSuite.create({
      data: { projectId: project.id, name, order: index },
    });
    suiteIds.set(name, suite.id);
  }

  const run = await prisma.testRun.create({
    data: {
      projectId: project.id,
      name: "Sprint 0 regression",
      description: "End-to-end regression across the customer portal.",
      environment: "Staging",
      createdById: admin.id,
    },
  });

  let number = 1;
  for (const spec of CASES) {
    const links = spec.links.map((issueKey) => {
      const issue = ISSUES[issueKey];
      return {
        issueKey,
        summary: issue?.summary ?? null,
        issueType: issue?.type ?? null,
        projectKey: PROJECT_KEY,
      };
    });

    const testCase = await prisma.testCase.create({
      data: {
        projectId: project.id,
        suiteId: suiteIds.get(spec.suite) ?? null,
        number: number++,
        title: spec.title,
        preconditions: "The staging environment is deployed with seeded data.",
        priority: spec.priority,
        createdById: admin.id,
        steps: {
          create: [
            { order: 0, action: "Open the customer portal", expectedResult: "The portal loads" },
            { order: 1, action: spec.title, expectedResult: "The expected behaviour is observed" },
          ],
        },
        jiraLinks: { create: links },
      },
    });

    await prisma.testRunItem.create({
      data: { runId: run.id, testCaseId: testCase.id, order: testCase.number },
    });

    if (spec.status) {
      await prisma.testExecution.create({
        data: {
          projectId: project.id,
          testCaseId: testCase.id,
          runId: run.id,
          status: spec.status,
          comment: spec.comment ?? null,
          executedById: admin.id,
        },
      });
    }
  }

  console.log(
    `Seeded "${PROJECT_KEY}" with ${CASES.length} cases linked to real Jira issues (${CASES.filter((c) => c.status === "FAIL").length} failing).`,
  );
  console.log(`Switch to the "${WORKSPACE_NAME}" workspace from the sidebar switcher.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
