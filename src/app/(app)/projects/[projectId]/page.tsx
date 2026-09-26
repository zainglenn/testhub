import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ResultsDonut } from "@/components/dashboard-charts";
import { StatCard } from "@/components/ui";
import { RUN_COLORS } from "@/lib/constants";
import { latestByCase, summarizeLatest } from "@/lib/metrics";
import { prisma } from "@/lib/prisma";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function ProjectOverviewPage(
  props: PageProps<"/projects/[projectId]">,
) {
  const { projectId } = await props.params;

  const workspace = await getWorkspace();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      _count: { select: { testCases: true, suites: true, runs: true } },
      runs: {
        orderBy: { createdAt: "desc" },
        take: 4,
        include: { _count: { select: { executions: true, items: true } } },
      },
    },
  });

  if (!project || (project.workspaceId && project.workspaceId !== workspace.id)) {
    notFound();
  }

  const executions = await prisma.testExecution.findMany({
    where: { projectId: project.id },
    orderBy: { executedAt: "desc" },
    select: { testCaseId: true, status: true, executedAt: true },
  });

  const summary = summarizeLatest(latestByCase(executions).values());
  const passRate = summary.passRate;
  const passed = summary.passed;
  const withResults = summary.total;
  const breakdown = summary.breakdown;

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", sm: "center" },
        }}
      >
        <Box>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <Chip size="small" color="primary" variant="outlined" label={project.key} />
            <Typography variant="h1">{project.name}</Typography>
          </Stack>
          {project.description ? (
            <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 680 }}>
              {project.description}
            </Typography>
          ) : null}
        </Box>
        <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
          <Button variant="outlined" href={`/projects/${project.id}/cases`}>
            Test cases
          </Button>
          <Button variant="contained" href={`/projects/${project.id}/runs`}>
            Test runs
          </Button>
        </Stack>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" },
          gap: 2,
        }}
      >
        <StatCard label="Test cases" value={project._count.testCases} />
        <StatCard label="Suites" value={project._count.suites} />
        <StatCard label="Test runs" value={project._count.runs} />
        <StatCard
          label="Latest pass rate"
          value={`${passRate}%`}
          hint={`${passed}/${withResults}`}
        />
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
            <Stack
              direction="row"
              sx={{
                justifyContent: "space-between",
                alignItems: "center",
                mb: 1,
              }}
            >
              <Typography variant="h6">Recent runs</Typography>
              <Button size="small" href={`/projects/${project.id}/runs`}>
                View all
              </Button>
            </Stack>
            {project.runs.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No test runs yet. Start one from the Test runs section.
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                {project.runs.map((run) => {
                  const progress =
                    run._count.items > 0
                      ? Math.round(
                          (run._count.executions / run._count.items) * 100,
                        )
                      : 0;
                  return (
                    <Link
                      key={run.id}
                      href={`/projects/${project.id}/runs/${run.id}`}
                      style={{ textDecoration: "none", color: "inherit" }}
                    >
                      <Box
                        sx={{
                          p: 1.5,
                          border: 1,
                          borderColor: "divider",
                          borderRadius: 1,
                          transition: "border-color .15s ease",
                          "&:hover": { borderColor: "primary.main" },
                        }}
                      >
                        <Stack
                          direction="row"
                          spacing={1}
                          sx={{
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <Typography variant="subtitle2">{run.name}</Typography>
                          <Chip
                            size="small"
                            label={run.status}
                            color={RUN_COLORS[run.status] ?? "default"}
                          />
                        </Stack>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: "block", mt: 0.5 }}
                        >
                          {run.environment ? `${run.environment} · ` : ""}
                          {run._count.executions}/{run._count.items} executed
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={progress}
                          sx={{ mt: 1, borderRadius: 1 }}
                        />
                      </Box>
                    </Link>
                  );
                })}
              </Stack>
            )}
          </CardContent>
        </Card>

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
              <Typography variant="h6">Latest results</Typography>
              <Button size="small" href={`/projects/${project.id}/reports`}>
                Reports
              </Button>
            </Stack>
            <ResultsDonut data={breakdown} />
          </CardContent>
        </Card>
      </Box>
    </Stack>
  );
}
