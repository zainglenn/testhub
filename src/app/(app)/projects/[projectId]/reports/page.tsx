import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ExecutionTrendChart,
  ResultsDonut,
} from "@/components/dashboard-charts";
import { StatCard } from "@/components/ui";
import { executionTrend, latestByCase, summarizeLatest } from "@/lib/metrics";
import { prisma } from "@/lib/prisma";
import { viewerHasProjectAccess } from "@/lib/project-access";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function ProjectReportsPage(
  props: PageProps<"/projects/[projectId]/reports">,
) {
  const { projectId } = await props.params;

  const workspace = await getWorkspace();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      suites: true,
      testCases: { select: { id: true, number: true, title: true, suiteId: true } },
    },
  });

  if (!project || !(await viewerHasProjectAccess(project, workspace.id))) {
    notFound();
  }

  const executions = await prisma.testExecution.findMany({
    where: { projectId: project.id },
    orderBy: { executedAt: "desc" },
    select: { testCaseId: true, status: true, executedAt: true },
  });

  const latestMap = latestByCase(executions);
  const summary = summarizeLatest(latestMap.values());
  const withResults = summary.total;
  const passed = summary.passed;
  const failed = summary.failed;
  const passRate = summary.passRate;
  const breakdown = summary.breakdown;

  const caseById = new Map(project.testCases.map((testCase) => [testCase.id, testCase]));
  const suiteNameById = new Map(project.suites.map((suite) => [suite.id, suite.name]));

  const failuresBySuite = new Map<string, number>();
  const failing: { testCase: typeof project.testCases[number] | undefined; executedAt: Date }[] =
    [];
  for (const [caseId, value] of latestMap) {
    if (value.status !== "FAIL") continue;
    const testCase = caseById.get(caseId);
    const suiteName = testCase?.suiteId
      ? (suiteNameById.get(testCase.suiteId) ?? "Unassigned")
      : "Unassigned";
    failuresBySuite.set(suiteName, (failuresBySuite.get(suiteName) ?? 0) + 1);
    failing.push({ testCase, executedAt: value.executedAt });
  }

  const failingCases = failing
    .filter((item) => item.testCase)
    .sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime())
    .slice(0, 8);

  const trendData = executionTrend(executions);

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h1">Reports</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          Pass rates, failure hotspots and execution activity for {project.name}.
        </Typography>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
          gap: 2,
        }}
      >
        <StatCard label="Latest pass rate" value={`${passRate}%`} hint={`${passed}/${withResults}`} />
        <StatCard label="Failing cases" value={failed} />
        <StatCard label="Executions (14d)" value={trendData.reduce((sum, point) => sum + point.executed, 0)} />
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" },
          gap: 3,
          alignItems: "stretch",
        }}
      >
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Execution trend (14 days)
            </Typography>
            <ExecutionTrendChart data={trendData} />
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Latest results
            </Typography>
            <ResultsDonut data={breakdown} />
          </CardContent>
        </Card>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
          gap: 3,
          alignItems: "start",
        }}
      >
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Failures by suite
            </Typography>
            {failuresBySuite.size === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No failing cases in the latest results.
              </Typography>
            ) : (
              <List dense disablePadding>
                {Array.from(failuresBySuite.entries())
                  .sort((a, b) => b[1] - a[1])
                  .map(([suiteName, count]) => (
                    <ListItem key={suiteName} divider>
                      <ListItemText primary={suiteName} />
                      <Typography variant="body2" color="text.secondary">
                        {count}
                      </Typography>
                    </ListItem>
                  ))}
              </List>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Recently failing
            </Typography>
            {failingCases.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No failing cases in the latest results.
              </Typography>
            ) : (
              <List dense disablePadding>
                {failingCases.map(
                  (item) =>
                    item.testCase && (
                      <ListItem key={item.testCase.id} divider>
                        <ListItemText
                          primary={
                            <Link
                              href={`/projects/${project.id}/cases?modal=${item.testCase.id}`}
                              style={{ color: "inherit", fontWeight: 500 }}
                            >
                              {project.key}-{item.testCase.number}{" "}
                              {item.testCase.title}
                            </Link>
                          }
                          secondary={`Last failed ${new Date(
                            item.executedAt,
                          ).toLocaleString()}`}
                        />
                      </ListItem>
                    ),
                )}
              </List>
            )}
          </CardContent>
        </Card>
      </Box>
    </Stack>
  );
}
