import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { notFound, redirect } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { projectInActiveWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

function formatDate(value: Date | null): string {
  return value ? new Date(value).toLocaleString() : "—";
}

export default async function RunReportPage(
  props: PageProps<"/report/run/[runId]">,
) {
  if (!(await getSession())) redirect("/login");

  const { runId } = await props.params;
  const run = await prisma.testRun.findUnique({
    where: { id: runId },
    include: {
      project: { select: { id: true, key: true, name: true } },
      plan: { select: { name: true } },
      assignee: { select: { name: true } },
      configurationRef: { select: { name: true } },
      items: {
        orderBy: { order: "asc" },
        include: { testCase: { include: { suite: true } } },
      },
      executions: {
        include: {
          executedBy: { select: { name: true } },
          stepResults: { orderBy: { order: "asc" } },
          evidence: true,
        },
      },
    },
  });
  if (!run) notFound();
  if (!(await projectInActiveWorkspace(run.project.id))) notFound();

  const executionByCase = new Map(
    run.executions.map((execution) => [execution.testCaseId, execution]),
  );
  const total = run.items.length;
  const executed = run.executions.length;
  const passed = run.executions.filter((e) => e.status === "PASS").length;
  const failed = run.executions.filter((e) => e.status === "FAIL").length;
  const blocked = run.executions.filter((e) => e.status === "BLOCKED").length;
  const skipped = run.executions.filter((e) => e.status === "SKIPPED").length;
  const passRate = executed > 0 ? Math.round((passed / executed) * 100) : 0;
  const failures = run.items.filter(
    (item) => executionByCase.get(item.testCaseId)?.status === "FAIL",
  );

  return (
    <Box
      sx={{
        maxWidth: 960,
        mx: "auto",
        p: 4,
        bgcolor: "background.paper",
        color: "text.primary",
      }}
    >
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}
      >
        <Box>
          <Typography variant="overline" color="text.secondary">
            TestHub · Test run report
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            {run.name}
          </Typography>
          <Typography color="text.secondary">
            {run.project.name} ({run.project.key})
          </Typography>
        </Box>
        <PrintButton />
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap" }}>
        <Chip size="small" label={run.status} />
        {run.environment ? (
          <Chip size="small" variant="outlined" label={`Env: ${run.environment}`} />
        ) : null}
        {run.configurationRef ? (
          <Chip
            size="small"
            variant="outlined"
            label={`Config: ${run.configurationRef.name}`}
          />
        ) : null}
        {run.plan ? (
          <Chip size="small" variant="outlined" label={`Plan: ${run.plan.name}`} />
        ) : null}
        {run.assignee ? (
          <Chip size="small" variant="outlined" label={`Assignee: ${run.assignee.name}`} />
        ) : null}
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Started {formatDate(run.createdAt)}
        {run.completedAt ? ` · Completed ${formatDate(run.completedAt)}` : ""}
      </Typography>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: 1,
          mb: 3,
          textAlign: "center",
        }}
      >
        {[
          ["Total", total],
          ["Executed", executed],
          ["Passed", passed],
          ["Failed", failed],
          ["Blocked", blocked],
          ["Skipped", skipped],
        ].map(([label, value]) => (
          <Box
            key={String(label)}
            sx={{ border: 1, borderColor: "divider", borderRadius: 1, py: 1 }}
          >
            <Typography variant="h6">{value}</Typography>
            <Typography variant="caption" color="text.secondary">
              {label}
            </Typography>
          </Box>
        ))}
      </Box>

      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
        Pass rate: {passRate}% ({passed}/{executed} executed)
      </Typography>

      <Divider sx={{ my: 2 }} />

      <Typography variant="h6" sx={{ mb: 1 }}>
        Results
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Key</TableCell>
            <TableCell>Title</TableCell>
            <TableCell>Suite</TableCell>
            <TableCell>Result</TableCell>
            <TableCell>Steps</TableCell>
            <TableCell>Executed</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {run.items.map((item) => {
            const execution = executionByCase.get(item.testCaseId);
            return (
              <TableRow key={item.id} sx={{ pageBreakInside: "avoid" }}>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  {run.project.key}-{item.testCase.number}
                </TableCell>
                <TableCell>{item.testCase.title}</TableCell>
                <TableCell>{item.testCase.suite?.name ?? "—"}</TableCell>
                <TableCell>{execution?.status ?? "UNTESTED"}</TableCell>
                <TableCell>
                  {execution && execution.stepResults.length > 0
                    ? execution.stepResults
                        .map((step, index) => `${index + 1}:${step.status}`)
                        .join(" ")
                    : "—"}
                </TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  {execution
                    ? `${execution.executedBy?.name ?? "—"} · ${formatDate(
                        execution.executedAt,
                      )}`
                    : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {failures.length > 0 ? (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Failures ({failures.length})
          </Typography>
          <Stack spacing={1.5}>
            {failures.map((item) => {
              const execution = executionByCase.get(item.testCaseId);
              return (
                <Box
                  key={item.id}
                  sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5, pageBreakInside: "avoid" }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {run.project.key}-{item.testCase.number} {item.testCase.title}
                  </Typography>
                  {execution?.comment ? (
                    <Typography variant="body2" color="text.secondary">
                      {execution.comment}
                    </Typography>
                  ) : null}
                  {execution && execution.stepResults.length > 0 ? (
                    <Typography variant="caption" color="text.secondary">
                      Steps:{" "}
                      {execution.stepResults
                        .map((step, index) => `${index + 1}=${step.status}`)
                        .join(", ")}
                    </Typography>
                  ) : null}
                  {execution && execution.evidence.length > 0 ? (
                    <Typography variant="caption" sx={{ display: "block" }}>
                      Evidence: {execution.evidence.map((e) => e.filename).join(", ")}
                    </Typography>
                  ) : null}
                </Box>
              );
            })}
          </Stack>
        </Box>
      ) : null}

      <Divider sx={{ my: 3 }} />
      <Typography variant="caption" color="text.secondary">
        Generated by TestHub · {new Date().toLocaleString()}
      </Typography>
    </Box>
  );
}
