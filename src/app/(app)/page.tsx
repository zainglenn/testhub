import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import {
  CoveragePie,
  ExecutionTrendChart,
  ProjectCasesChart,
  ResultsDonut,
} from "@/components/dashboard-charts";
import { StatCard } from "@/components/ui";
import { disconnectJira } from "@/lib/actions/jira";
import { plural } from "@/lib/format";
import { getJiraConfig, isJiraEnabled } from "@/lib/jira/config";
import { getJiraConnection } from "@/lib/jira/client";
import { executionTrend, latestByCase, summarizeLatest } from "@/lib/metrics";
import { prisma } from "@/lib/prisma";
import { projectAccessContext, visibleProjectWhere } from "@/lib/project-access";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const JIRA_MESSAGES: Record<string, { text: string; tone: "success" | "error" }> = {
  connected: { text: "Jira connected successfully.", tone: "success" },
  unconfigured: {
    text: "Set JIRA_CLIENT_ID and JIRA_CLIENT_SECRET in .env to connect Jira.",
    tone: "error",
  },
  "invalid-state": {
    text: "The Jira authorization request expired or did not match. Please try again.",
    tone: "error",
  },
  "no-accessible-site": {
    text: "No Jira site was accessible for this account.",
    tone: "error",
  },
  "exchange-failed": {
    text: "Could not exchange the authorization code with Atlassian.",
    tone: "error",
  },
};

export default async function HomePage(props: PageProps<"/">) {
  const { jira: jiraParam } = await props.searchParams;
  const config = getJiraConfig();
  const jiraEnabled = isJiraEnabled();
  const connection = jiraEnabled ? await getJiraConnection() : null;

  const workspace = await getWorkspace();
  const access = await projectAccessContext();
  const visible = visibleProjectWhere(
    access?.userId ?? "",
    access?.canManageAll ?? false,
  );

  const projects = await prisma.project.findMany({
    where: { workspaceId: workspace.id, ...visible },
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { testCases: true, suites: true } },
    },
  });

  const [projectCount, testCaseCount, suiteCount, jiraLinkedCount] =
    await Promise.all([
      prisma.project.count({ where: { workspaceId: workspace.id, ...visible } }),
      prisma.testCase.count({
        where: { project: { workspaceId: workspace.id, ...visible } },
      }),
      prisma.testSuite.count({
        where: { project: { workspaceId: workspace.id, ...visible } },
      }),
      prisma.testCase.count({
        where: {
          project: { workspaceId: workspace.id, ...visible },
          jiraLinks: { some: {} },
        },
      }),
    ]);

  const coverage =
    testCaseCount > 0 ? Math.round((jiraLinkedCount / testCaseCount) * 100) : 0;

  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - 13);

  const executions = await prisma.testExecution.findMany({
    where: {
      project: { workspaceId: workspace.id, ...visible },
      executedAt: { gte: since },
    },
    select: { testCaseId: true, status: true, executedAt: true },
  });

  const trend = executionTrend(executions);
  const summary = summarizeLatest(latestByCase(executions).values());
  const executionCount = executions.length;
  const resultBreakdown = summary.breakdown;

  const jiraKey = typeof jiraParam === "string" ? jiraParam : undefined;
  const jiraMessage = jiraKey
    ? JIRA_MESSAGES[jiraKey] ?? {
        text: `Jira authorization failed (${jiraKey}).`,
        tone: "error" as const,
      }
    : undefined;

  return (
    <Stack spacing={4}>
      <Box>
        <Typography variant="h1">Test management, wired into Jira</Typography>
        <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 640 }}>
          Author test cases and suites, organise them by project, and trace them
          directly to Jira Cloud issues.
        </Typography>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            lg: "repeat(4, 1fr)",
          },
          gap: 2,
        }}
      >
        <StatCard label="Projects" value={projectCount} />
        <StatCard label="Test cases" value={testCaseCount} />
        <StatCard label="Suites" value={suiteCount} />
        {jiraEnabled ? (
          <StatCard
            label="Jira coverage"
            value={`${coverage}%`}
            hint={`${jiraLinkedCount}/${testCaseCount}`}
          />
        ) : (
          <StatCard label="Executions (14d)" value={executionCount} />
        )}
      </Box>

      {jiraMessage ? (
        <Alert severity={jiraMessage.tone}>{jiraMessage.text}</Alert>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" },
          gap: 3,
        }}
      >
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Test assets by project
            </Typography>
            {projects.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Create a project to see charts.
              </Typography>
            ) : (
              <ProjectCasesChart
                data={projects.map((project) => ({
                  label: project.key,
                  cases: project._count.testCases,
                  suites: project._count.suites,
                }))}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>
              {jiraEnabled ? "Jira coverage" : "Results (14 days)"}
            </Typography>
            {jiraEnabled ? (
              <CoveragePie
                linked={jiraLinkedCount}
                unlinked={testCaseCount - jiraLinkedCount}
              />
            ) : (
              <ResultsDonut data={resultBreakdown} />
            )}
          </CardContent>
        </Card>
      </Box>

      <Card>
        <CardContent>
          <Stack
            direction="row"
            sx={{
              justifyContent: "space-between",
              alignItems: "center",
              mb: 1,
            }}
          >
            <Typography variant="h6">Execution trend</Typography>
            <Typography variant="body2" color="text.secondary">
              Last 14 days · {executionCount} execution
              {executionCount === 1 ? "" : "s"}
            </Typography>
          </Stack>
          {executionCount === 0 ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ py: 4, textAlign: "center" }}
            >
              No executions recorded yet. Record one from any test case.
            </Typography>
          ) : (
            <ExecutionTrendChart data={trend} />
          )}
        </CardContent>
      </Card>

      {jiraEnabled ? (
      <Card>
        <CardContent>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{
              justifyContent: "space-between",
              alignItems: { xs: "flex-start", sm: "center" },
            }}
          >
            <Box>
              <Typography variant="h6">Jira integration</Typography>
              {connection ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.5 }}
                >
                  Connected to{" "}
                  <a
                    href={connection.siteUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "inherit", fontWeight: 600 }}
                  >
                    {connection.siteName ?? connection.siteUrl}
                  </a>{" "}
                  via OAuth 2.0.
                </Typography>
              ) : (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.5, maxWidth: 560 }}
                >
                  Connect your Atlassian account to search and link Jira issues
                  from every test case. Tokens are stored locally and refreshed
                  automatically.
                </Typography>
              )}
            </Box>

            <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
              {connection ? (
                <>
                  <Button
                    variant="outlined"
                    href="/api/jira/oauth/start"
                  >
                    Reconnect
                  </Button>
                  <Box component="form" action={disconnectJira}>
                    <Button type="submit" variant="outlined" color="error">
                      Disconnect
                    </Button>
                  </Box>
                </>
              ) : config.configured ? (
                <Button
                  variant="contained"
                  href="/api/jira/oauth/start"
                >
                  Connect Jira Cloud
                </Button>
              ) : (
                <Chip color="warning" label="Not configured" />
              )}
            </Stack>
          </Stack>

          {!config.configured ? (
            <Box
              sx={{
                mt: 2,
                p: 1.5,
                borderRadius: 1,
                bgcolor: "action.hover",
              }}
            >
              <Typography
                variant="caption"
                sx={{ fontFamily: "var(--font-geist-mono), monospace" }}
              >
                JIRA_CLIENT_ID=... JIRA_CLIENT_SECRET=... (see README)
              </Typography>
            </Box>
          ) : null}
        </CardContent>
      </Card>
      ) : null}

      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center" }}
      >
        <Typography variant="h2">Recent projects</Typography>
        <Button variant="outlined" href="/projects">
          View all projects
        </Button>
      </Stack>

      {projects.length === 0 ? (
        <Card sx={{ borderStyle: "dashed" }}>
          <CardContent sx={{ textAlign: "center", py: 6 }}>
            <Typography color="text.secondary">
              No projects yet. Create your first project to get started.
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Button variant="contained" href="/projects#new-project">
                New project
              </Button>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
            gap: 2,
          }}
        >
          {projects.slice(0, 4).map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <Card
                sx={{
                  height: "100%",
                  transition: "border-color .15s ease",
                  "&:hover": { borderColor: "primary.main" },
                }}
              >
                <CardContent>
                  <Stack
                    direction="row"
                    spacing={1.5}
                    sx={{ alignItems: "center" }}
                  >
                    <Chip
                      size="small"
                      color="primary"
                      variant="outlined"
                      label={project.key}
                    />
                    <Typography variant="subtitle1">
                      {project.name}
                    </Typography>
                  </Stack>
                  {project.description ? (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        mt: 1,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {project.description}
                    </Typography>
                  ) : null}
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 1.5, display: "block" }}
                  >
                    {plural(project._count.testCases, "test case")} ·{" "}
                    {plural(project._count.suites, "suite")}
                  </Typography>
                </CardContent>
              </Card>
            </Link>
          ))}
        </Box>
      )}
    </Stack>
  );
}
