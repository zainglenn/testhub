import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import LinearProgress from "@mui/material/LinearProgress";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/confirm-button";
import { FormDialog } from "@/components/form-dialog";
import {
  addCaseToPlan,
  addRunToPlan,
  deleteTestPlan,
  removeCaseFromPlan,
  setRunPlan,
  startRunForPlan,
  updateTestPlan,
} from "@/lib/actions/plans";
import { StatCard } from "@/components/ui";
import { RUN_COLORS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { viewerHasProjectAccess } from "@/lib/project-access";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function TestPlanPage(
  props: PageProps<"/projects/[projectId]/plans/[planId]">,
) {
  const { projectId, planId } = await props.params;

  const workspace = await getWorkspace();
  const plan = await prisma.testPlan.findUnique({
    where: { id: planId },
    include: {
      project: { select: { id: true, key: true, name: true, workspaceId: true, restricted: true } },
      testSet: { select: { id: true, name: true } },
      items: {
        orderBy: { order: "asc" },
        include: { testCase: { select: { id: true, number: true, title: true } } },
      },
      runs: {
        orderBy: { createdAt: "desc" },
        include: {
          assignee: { select: { name: true } },
          executions: { select: { status: true } },
          _count: { select: { executions: true, items: true } },
        },
      },
    },
  });

  if (
    !plan ||
    plan.projectId !== projectId ||
    !(await viewerHasProjectAccess(plan.project, workspace.id))
  ) {
    notFound();
  }

  const availableRuns = await prisma.testRun.findMany({
    where: {
      projectId: plan.projectId,
      OR: [{ planId: null }, { planId: { not: plan.id } }],
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
  });

  const projectTestSets = await prisma.testSet.findMany({
    where: { projectId: plan.projectId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const projectCases = await prisma.testCase.findMany({
    where: { projectId: plan.projectId },
    orderBy: { number: "asc" },
    select: { id: true, number: true, title: true },
  });
  const planMemberIds = new Set(plan.items.map((item) => item.testCaseId));
  const caseCandidates = projectCases.filter((c) => !planMemberIds.has(c.id));

  const rollupExecuted = plan.runs.reduce(
    (sum, run) => sum + run.executions.length,
    0,
  );
  const rollupPassed = plan.runs.reduce(
    (sum, run) => sum + run.executions.filter((e) => e.status === "PASS").length,
    0,
  );
  const rollupFailed = plan.runs.reduce(
    (sum, run) => sum + run.executions.filter((e) => e.status === "FAIL").length,
    0,
  );
  const rollupPassRate =
    rollupExecuted > 0 ? Math.round((rollupPassed / rollupExecuted) * 100) : 0;

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
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Typography variant="h1">{plan.name}</Typography>
            <Chip
              size="small"
              label={plan.status}
              color={plan.status === "COMPLETED" ? "success" : "info"}
              variant="outlined"
            />
            <Chip size="small" variant="outlined" label={`${plan.runs.length} runs`} />
          </Stack>
          {plan.description ? (
            <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 680 }}>
              {plan.description}
            </Typography>
          ) : null}
        </Box>
        <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
          <Box component="form" action={startRunForPlan}>
            <input type="hidden" name="planId" value={plan.id} />
            <Button type="submit" variant="contained">
              Start a run
            </Button>
          </Box>
          <Button
            component="a"
            href={`/report/plan/${plan.id}`}
            target="_blank"
            variant="outlined"
          >
            Report
          </Button>
          <FormDialog
            action={updateTestPlan}
            hidden={{ id: plan.id }}
            title="Edit plan"
            triggerLabel="Edit"
            triggerVariant="outlined"
            submitLabel="Save changes"
            successMessage="Plan updated"
          >
            <TextField name="name" label="Name" defaultValue={plan.name} required />
            <TextField
              name="description"
              label="Description"
              defaultValue={plan.description ?? ""}
              multiline
              minRows={2}
            />
            <TextField
              select
              name="status"
              label="Status"
              defaultValue={plan.status}
            >
              <MenuItem value="OPEN">Open</MenuItem>
              <MenuItem value="COMPLETED">Completed</MenuItem>
            </TextField>
            <TextField
              select
              name="testSetId"
              label="Test scope (test set)"
              defaultValue={plan.testSetId ?? ""}
              helperText="When set, Start a run uses this test set's cases."
            >
              <MenuItem value="">All project cases</MenuItem>
              {projectTestSets.map((testSet) => (
                <MenuItem key={testSet.id} value={testSet.id}>
                  {testSet.name}
                </MenuItem>
              ))}
            </TextField>
          </FormDialog>
          <ConfirmButton
            action={deleteTestPlan}
            hidden={{ id: plan.id }}
            title="Delete plan?"
            description="Delete this plan? Its runs are kept but detached from the plan."
            confirmLabel="Delete plan"
            label="Delete"
          />
        </Stack>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(4, 1fr)" },
          gap: 2,
        }}
      >
        <StatCard label="Pass rate" value={`${rollupPassRate}%`} />
        <StatCard label="Passed" value={rollupPassed} />
        <StatCard label="Failed" value={rollupFailed} />
        <StatCard label="Executed" value={rollupExecuted} />
      </Box>

      <Card>
        <CardContent>
          <Stack
            direction="row"
            spacing={1}
            sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}
          >
            <Typography variant="h6">
              Tests in this plan ({plan.items.length})
            </Typography>
            {caseCandidates.length > 0 ? (
              <FormDialog
                action={addCaseToPlan}
                hidden={{ planId: plan.id }}
                title="Add a test to this plan"
                triggerLabel="Add test"
                triggerVariant="outlined"
                submitLabel="Add test"
                successMessage="Test added"
              >
                <TextField
                  select
                  name="testCaseId"
                  label="Test case"
                  defaultValue={caseCandidates[0]?.id ?? ""}
                >
                  {caseCandidates.map((testCase) => (
                    <MenuItem key={testCase.id} value={testCase.id}>
                      {`${plan.project.key}-${testCase.number} ${testCase.title}`}
                    </MenuItem>
                  ))}
                </TextField>
              </FormDialog>
            ) : null}
          </Stack>

          {plan.items.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No tests yet — Start a run uses the test scope (test set), or all
              project cases.
            </Typography>
          ) : (
            <Stack spacing={0.5}>
              {plan.items.map((item) => (
                <Stack
                  key={item.id}
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center", justifyContent: "space-between" }}
                >
                  <Typography variant="body2">
                    <Box
                      component="span"
                      sx={{
                        fontFamily: "var(--font-geist-mono), monospace",
                        color: "text.secondary",
                        mr: 1,
                      }}
                    >
                      {plan.project.key}-{item.testCase.number}
                    </Box>
                    <Link
                      href={`/projects/${plan.project.id}/cases?modal=${item.testCase.id}`}
                      style={{ color: "inherit" }}
                    >
                      {item.testCase.title}
                    </Link>
                  </Typography>
                  <ConfirmButton
                    action={removeCaseFromPlan}
                    hidden={{ id: item.id }}
                    title="Remove test?"
                    description="Remove this test from the plan?"
                    confirmLabel="Remove"
                    color="inherit"
                    iconOnly
                    ariaLabel="Remove test"
                    icon={<DeleteOutlinedIcon sx={{ fontSize: 16 }} />}
                  />
                </Stack>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack
            direction="row"
            spacing={1}
            sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}
          >
            <Typography variant="h6">Runs</Typography>
            {availableRuns.length > 0 ? (
              <FormDialog
                action={addRunToPlan}
                hidden={{ planId: plan.id }}
                title="Add run to plan"
                description="Pick an existing run to include in this plan."
                triggerLabel="Add run"
                triggerVariant="outlined"
                submitLabel="Add run"
                successMessage="Run added to plan"
              >
                <TextField select name="runId" label="Run" defaultValue="" required>
                  {availableRuns.map((run) => (
                    <MenuItem key={run.id} value={run.id}>
                      {run.name}
                    </MenuItem>
                  ))}
                </TextField>
              </FormDialog>
            ) : null}
          </Stack>

          {plan.runs.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No runs in this plan yet.
            </Typography>
          ) : (
            <Stack divider={<Divider />} spacing={0}>
              {plan.runs.map((run) => {
                const progress =
                  run._count.items > 0
                    ? Math.round((run._count.executions / run._count.items) * 100)
                    : 0;
                return (
                  <Stack
                    key={run.id}
                    direction={{ xs: "column", sm: "row" }}
                    spacing={2}
                    sx={{
                      py: 1.5,
                      justifyContent: "space-between",
                      alignItems: { xs: "flex-start", sm: "center" },
                    }}
                  >
                    <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        <Link
                          href={`/projects/${plan.projectId}/runs/${run.id}`}
                          style={{ textDecoration: "none", color: "inherit" }}
                        >
                          <Typography variant="subtitle2">{run.name}</Typography>
                        </Link>
                        <Chip
                          size="small"
                          label={run.status}
                          color={RUN_COLORS[run.status] ?? "default"}
                        />
                        {run.environment ? (
                          <Chip size="small" variant="outlined" label={run.environment} />
                        ) : null}
                        {run.assignee ? (
                          <Chip size="small" variant="outlined" label={run.assignee.name} />
                        ) : null}
                      </Stack>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block", mt: 0.5 }}
                      >
                        {run._count.executions}/{run._count.items} executed
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={progress}
                        sx={{ mt: 0.5, borderRadius: 1, maxWidth: 360 }}
                      />
                    </Box>
                    <Box sx={{ flexShrink: 0 }}>
                      <Box component="form" action={setRunPlan}>
                        <input type="hidden" name="runId" value={run.id} />
                        <input type="hidden" name="planId" value="" />
                        <Button size="small" type="submit" color="inherit">
                          Remove
                        </Button>
                      </Box>
                    </Box>
                  </Stack>
                );
              })}
            </Stack>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
