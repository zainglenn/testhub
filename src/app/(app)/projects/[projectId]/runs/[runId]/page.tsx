import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/confirm-button";
import { RunCaseRow } from "@/components/run-case-row";
import { StatCard } from "@/components/ui";
import {
  completeTestRun,
  deleteTestRun,
  reopenTestRun,
} from "@/lib/actions/runs";
import { RUN_COLORS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function RunPage(
  props: PageProps<"/projects/[projectId]/runs/[runId]">,
) {
  const { runId } = await props.params;

  const run = await prisma.testRun.findUnique({
    where: { id: runId },
    include: {
      project: true,
      executions: { include: { stepResults: true, evidence: true } },
      createdBy: { select: { name: true } },
      items: {
        orderBy: { order: "asc" },
        include: {
          testCase: {
            include: {
              suite: true,
              steps: { orderBy: { order: "asc" } },
            },
          },
        },
      },
    },
  });
  if (!run) {
    notFound();
  }

  const cases = run.items.map((item) => item.testCase);

  const resultByCase = new Map(
    run.executions.map((execution) => [execution.testCaseId, execution]),
  );

  const total = cases.length;
  const executed = run.executions.length;
  const progress = total > 0 ? Math.round((executed / total) * 100) : 0;
  const passed = run.executions.filter((e) => e.status === "PASS").length;
  const failed = run.executions.filter((e) => e.status === "FAIL").length;
  const other = executed - passed - failed;

  const groups = new Map<string, { name: string; items: typeof cases }>();
  for (const testCase of cases) {
    const key = testCase.suiteId ?? "__none__";
    if (!groups.has(key)) {
      groups.set(key, {
        name: testCase.suite?.name ?? "Unassigned",
        items: [],
      });
    }
    groups.get(key)!.items.push(testCase);
  }

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <Link
          href={`/projects/${run.project.id}`}
          style={{ textDecoration: "none" }}
        >
          <Typography variant="body2" color="text.secondary">
            {run.project.name}
          </Typography>
        </Link>
        <Typography variant="body2" color="text.secondary">
          /
        </Typography>
        <Link
          href={`/projects/${run.project.id}/runs`}
          style={{ textDecoration: "none" }}
        >
          <Typography variant="body2" color="text.secondary">
            Test runs
          </Typography>
        </Link>
      </Stack>

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
            <Typography variant="h1">{run.name}</Typography>
            <Chip
              size="small"
              label={run.status}
              color={RUN_COLORS[run.status] ?? "default"}
            />
            {run.environment ? (
              <Chip size="small" variant="outlined" label={run.environment} />
            ) : null}
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Started {new Date(run.createdAt).toLocaleString()}
            {run.createdBy ? ` by ${run.createdBy.name}` : ""}
            {run.completedAt
              ? ` · Completed ${new Date(run.completedAt).toLocaleString()}`
              : ""}
          </Typography>
          {run.description ? (
            <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 680 }}>
              {run.description}
            </Typography>
          ) : null}
        </Box>

        <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
          {run.status === "OPEN" ? (
            <Box component="form" action={completeTestRun}>
              <input type="hidden" name="id" value={run.id} />
              <Button type="submit" variant="contained">
                Complete run
              </Button>
            </Box>
          ) : (
            <Box component="form" action={reopenTestRun}>
              <input type="hidden" name="id" value={run.id} />
              <Button type="submit" variant="outlined">
                Reopen run
              </Button>
            </Box>
          )}
          <ConfirmButton
            action={deleteTestRun}
            hidden={{ id: run.id, projectId: run.project.id }}
            title="Delete run?"
            description="The run and its recorded results are removed. This cannot be undone."
            confirmLabel="Delete run"
            label="Delete"
          />
        </Stack>
      </Stack>

      {run.status === "COMPLETED" ? (
        <Alert severity="info">
          This run is completed and its results are locked. Use{" "}
          <strong>Reopen run</strong> to make changes.
        </Alert>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(4, 1fr)" },
          gap: 2,
        }}
      >
        <StatCard
          label="Executed"
          value={executed}
          hint={`/ ${total}`}
        />
        <StatCard label="Passed" value={passed} />
        <StatCard label="Failed" value={failed} />
        <StatCard label="Blocked / Skipped" value={other} />
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
            <Typography variant="h6">Progress</Typography>
            <Typography variant="body2" color="text.secondary">
              {progress}%
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ height: 8, borderRadius: 4 }}
          />
        </CardContent>
      </Card>

      {total === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: "center", py: 6 }}>
            <Typography color="text.secondary">
              This project has no test cases to run yet.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            {Array.from(groups.entries()).map(([key, group], groupIndex) => (
              <Box
                key={key}
                sx={{
                  pt: groupIndex === 0 ? 0 : 3,
                  mt: groupIndex === 0 ? 0 : 3,
                  borderTop: groupIndex === 0 ? 0 : 1,
                  borderColor: "divider",
                }}
              >
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  {group.name}
                </Typography>
                <Stack spacing={1}>
                  {group.items.map((testCase) => {
                    const execution = resultByCase.get(testCase.id);
                    return (
                      <RunCaseRow
                        key={testCase.id}
                        runId={run.id}
                        projectId={run.project.id}
                        caseKey={`${run.project.key}-${testCase.number}`}
                        testCaseId={testCase.id}
                        title={testCase.title}
                        steps={testCase.steps}
                        executionId={execution?.id ?? null}
                        status={execution?.status ?? null}
                        comment={execution?.comment ?? null}
                        stepResults={(execution?.stepResults ?? []).map(
                          (result) => ({
                            id: result.id,
                            order: result.order,
                            status: result.status,
                            comment: result.comment,
                          }),
                        )}
                        evidence={(execution?.evidence ?? []).map((item) => ({
                          id: item.id,
                          filename: item.filename,
                          executionStepId: item.executionStepId,
                        }))}
                        disabled={run.status === "COMPLETED"}
                      />
                    );
                  })}
                </Stack>
              </Box>
            ))}
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
