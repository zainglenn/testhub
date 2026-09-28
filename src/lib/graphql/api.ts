import { buildSchema, type GraphQLSchema } from "graphql";
import { latestByCase, summarizeLatest } from "@/lib/metrics";
import { prisma } from "@/lib/prisma";

export const schema: GraphQLSchema = buildSchema(`
  type Project { id: ID!, key: String!, name: String!, jiraProjectKey: String }
  type Suite { id: ID!, name: String! }
  type Test {
    id: ID!
    key: String!
    title: String!
    priority: String!
    status: String!
    suite: Suite
    latestStatus: String
    lastExecutedAt: String
    url: String
  }
  type RunSummary {
    id: ID!
    name: String!
    status: String!
    environment: String
    total: Int!
    executed: Int!
    passed: Int!
    failed: Int!
  }
  type Coverage { total: Int!, passed: Int!, failed: Int!, coverage: Int! }
  type Query {
    project(key: String): Project
    tests(projectKey: String, query: String, limit: Int): [Test!]!
    runs(projectKey: String, limit: Int): [RunSummary!]!
    coverage(issueKey: String!): Coverage
  }
`);

export type GraphQLContext = {
  scopedProjectId?: string;
  appBase: string;
};

type Args = { projectKey?: string; query?: string; limit?: number; key?: string; issueKey?: string };

const PROJECT_SELECT = {
  id: true,
  key: true,
  name: true,
  jiraProjectKey: true,
} as const;

async function resolveProject(args: Args, ctx: GraphQLContext) {
  if (ctx.scopedProjectId) {
    return prisma.project.findUnique({
      where: { id: ctx.scopedProjectId },
      select: PROJECT_SELECT,
    });
  }
  if (args.projectKey) {
    return prisma.project.findFirst({
      where: { key: args.projectKey },
      select: PROJECT_SELECT,
    });
  }
  return null;
}

async function requireProject(args: Args, ctx: GraphQLContext) {
  const project = await resolveProject(args, ctx);
  if (!project) {
    throw new Error("Project not found — provide projectKey.");
  }
  return project;
}

export const rootValue = {
  project: (args: Args, ctx: GraphQLContext) => resolveProject(args, ctx),

  tests: async (args: Args, ctx: GraphQLContext) => {
    const project = await requireProject(args, ctx);
    const cases = await prisma.testCase.findMany({
      where: {
        projectId: project.id,
        ...(args.query
          ? { title: { contains: args.query, mode: "insensitive" as const } }
          : {}),
      },
      orderBy: { number: "asc" },
      take: Math.min(args.limit ?? 25, 500),
      select: {
        id: true,
        number: true,
        title: true,
        priority: true,
        status: true,
        suite: { select: { id: true, name: true } },
        executions: {
          orderBy: { executedAt: "desc" },
          take: 1,
          select: { status: true, executedAt: true },
        },
      },
    });
    return cases.map((testCase) => ({
      id: testCase.id,
      key: `${project.key}-${testCase.number}`,
      title: testCase.title,
      priority: testCase.priority,
      status: testCase.status,
      suite: testCase.suite,
      latestStatus: testCase.executions[0]?.status ?? null,
      lastExecutedAt: testCase.executions[0]?.executedAt?.toISOString() ?? null,
      url: ctx.appBase
        ? `${ctx.appBase}/projects/${project.id}/cases?case=${testCase.id}`
        : null,
    }));
  },

  runs: async (args: Args, ctx: GraphQLContext) => {
    const project = await requireProject(args, ctx);
    const runs = await prisma.testRun.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "desc" },
      take: Math.min(args.limit ?? 10, 100),
      select: {
        id: true,
        name: true,
        status: true,
        environment: true,
        executions: { select: { status: true } },
        _count: { select: { items: true } },
      },
    });
    return runs.map((run) => ({
      id: run.id,
      name: run.name,
      status: run.status,
      environment: run.environment,
      total: run._count.items,
      executed: run.executions.length,
      passed: run.executions.filter((e) => e.status === "PASS").length,
      failed: run.executions.filter((e) => e.status === "FAIL").length,
    }));
  },

  coverage: async (args: Args, ctx: GraphQLContext) => {
    const issueKey = args.issueKey ?? "";
    if (!issueKey) return { total: 0, passed: 0, failed: 0, coverage: 0 };

    const links = await prisma.jiraIssueLink.findMany({
      where: {
        issueKey,
        ...(ctx.scopedProjectId
          ? { testCase: { projectId: ctx.scopedProjectId } }
          : {}),
      },
      select: { testCaseId: true },
    });
    const caseIds = [...new Set(links.map((link) => link.testCaseId))];
    if (caseIds.length === 0) {
      return { total: 0, passed: 0, failed: 0, coverage: 0 };
    }
    const executions = await prisma.testExecution.findMany({
      where: { testCaseId: { in: caseIds } },
      orderBy: { executedAt: "asc" },
      select: { testCaseId: true, status: true, executedAt: true },
    });
    const summary = summarizeLatest(latestByCase(executions).values());
    const total = caseIds.length;
    return {
      total,
      passed: summary.passed,
      failed: summary.failed,
      coverage: total > 0 ? Math.round((summary.passed / total) * 100) : 0,
    };
  },
};
