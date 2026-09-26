import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormDialog } from "@/components/form-dialog";
import { RunControls } from "@/components/run-controls";
import { RunScopeFields } from "@/components/run-scope-fields";
import { createTestRun } from "@/lib/actions/runs";
import { RUN_COLORS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { viewerHasProjectAccess } from "@/lib/project-access";
import { buildSuiteTree, flattenSuites } from "@/lib/suites";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function ProjectRunsPage(
  props: PageProps<"/projects/[projectId]/runs">,
) {
  const { projectId } = await props.params;

  const workspace = await getWorkspace();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      suites: { orderBy: [{ order: "asc" }, { name: "asc" }] },
      tags: { orderBy: { name: "asc" }, select: { id: true, name: true } },
      runs: {
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { executions: true, items: true } },
          plan: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!project || !(await viewerHasProjectAccess(project, workspace.id))) {
    notFound();
  }

  const [suiteOptions, members, plans] = await Promise.all([
    Promise.resolve(flattenSuites(buildSuiteTree(project.suites))),
    prisma.workspaceMember.findMany({
      where: { workspaceId: workspace.id },
      select: { user: { select: { id: true, name: true } } },
    }),
    prisma.testPlan.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true },
    }),
  ]);
  const memberOptions = members
    .map((member) => member.user)
    .sort((a, b) => a.name.localeCompare(b.name));

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
          <Typography variant="h1">Test runs</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Run a chosen scope of cases, assign them, record results and track
            pass rates.
          </Typography>
        </Box>
        <FormDialog
          action={createTestRun}
          hidden={{ projectId: project.id }}
          title="Start a run"
          description="Pick the cases to include and record results per case."
          triggerLabel="Start a run"
          submitLabel="Start run"
          successMessage="Run started"
        >
          <TextField
            name="name"
            label="Run name"
            placeholder="Nightly regression"
            required
          />
          <RunScopeFields suiteOptions={suiteOptions} tags={project.tags} />
          <TextField
            name="description"
            label="Description"
            multiline
            minRows={2}
          />
        </FormDialog>
      </Stack>

      {project.runs.length === 0 ? (
        <Card sx={{ borderStyle: "dashed" }}>
          <CardContent sx={{ textAlign: "center", py: 8 }}>
            <Typography color="text.secondary">
              No test runs yet. Use <strong>Start a run</strong> to record
              results against a scope of cases.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, 1fr)",
              lg: "repeat(3, 1fr)",
            },
            gap: 2,
          }}
        >
          {project.runs.map((run) => {
            const progress =
              run._count.items > 0
                ? Math.round((run._count.executions / run._count.items) * 100)
                : 0;
            return (
              <Card
                key={run.id}
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  transition: "border-color .15s ease, box-shadow .15s ease",
                  "&:hover": { borderColor: "primary.main", boxShadow: 2 },
                }}
              >
                <CardContent
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                    flexGrow: 1,
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <Link
                      href={`/projects/${project.id}/runs/${run.id}`}
                      style={{ textDecoration: "none", color: "inherit" }}
                    >
                      <Typography variant="subtitle1">{run.name}</Typography>
                    </Link>
                    <Chip
                      size="small"
                      label={run.status}
                      color={RUN_COLORS[run.status] ?? "default"}
                    />
                  </Stack>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center", flexWrap: "wrap" }}
                  >
                    {run.environment ? (
                      <Chip
                        size="small"
                        variant="outlined"
                        label={run.environment}
                      />
                    ) : null}
                    {run.plan ? (
                      <Chip
                        size="small"
                        variant="outlined"
                        color="primary"
                        label={run.plan.name}
                      />
                    ) : null}
                    {run.assignee ? (
                      <Chip
                        size="small"
                        variant="outlined"
                        label={run.assignee.name}
                      />
                    ) : null}
                    <Typography variant="caption" color="text.secondary">
                      {new Date(run.createdAt).toLocaleDateString()}
                    </Typography>
                  </Stack>
                  {run.description ? (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {run.description}
                    </Typography>
                  ) : null}
                  <Box sx={{ flexGrow: 1 }} />
                  <Typography variant="caption" color="text.secondary">
                    {run._count.executions}/{run._count.items} executed
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={progress}
                    sx={{ borderRadius: 1 }}
                  />
                </CardContent>
                <Divider />
                <Box sx={{ p: 1.5 }}>
                  <RunControls
                    runId={run.id}
                    assigneeId={run.assigneeId}
                    planId={run.planId}
                    members={memberOptions}
                    plans={plans}
                  />
                </Box>
              </Card>
            );
          })}
        </Box>
      )}
    </Stack>
  );
}
