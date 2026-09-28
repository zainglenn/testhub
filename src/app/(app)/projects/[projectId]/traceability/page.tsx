import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { StatCard } from "@/components/ui";
import { syncRequirements } from "@/lib/actions/requirements";
import { prisma } from "@/lib/prisma";
import { viewerHasProjectAccess } from "@/lib/project-access";
import { buildTraceability } from "@/lib/traceability";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

function coverageColor(coverage: number) {
  if (coverage >= 80) return "success";
  if (coverage >= 50) return "warning";
  return "error";
}

export default async function TraceabilityPage(
  props: PageProps<"/projects/[projectId]/traceability">,
) {
  const { projectId } = await props.params;

  const workspace = await getWorkspace();
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, key: true, name: true, workspaceId: true, restricted: true },
  });
  if (!project || !(await viewerHasProjectAccess(project, workspace.id))) {
    notFound();
  }

  const data = await buildTraceability(project.id);
  const requirements = data?.requirements ?? [];
  const total = requirements.length;
  const fullyCovered = requirements.filter((r) => r.coverage >= 80).length;
  const gaps = requirements.filter((r) => r.tests.length === 0).length;
  const failing = requirements.filter((r) => r.failed > 0).length;

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
          <Typography variant="h1">Traceability</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 720 }}>
            Requirements synced from Jira, traced to TestHub cases, their latest
            results and any linked bugs.
          </Typography>
        </Box>
        <Button
          component="a"
          href={`/api/projects/${project.id}/traceability/export`}
          variant="outlined"
          sx={{ flexShrink: 0 }}
        >
          Export CSV
        </Button>
      </Stack>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Sync requirements
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Pulls matching issues from the connected Jira site and stores them so
            the matrix works offline.
          </Typography>
          <ActionForm
            action={syncRequirements}
            hidden={{ projectId: project.id }}
            submitLabel="Sync from Jira"
            successMessage="Requirements synced"
          >
            <TextField
              name="jql"
              label="JQL"
              defaultValue={data?.jql}
              fullWidth
              slotProps={{
                htmlInput: {
                  style: { fontFamily: "var(--font-geist-mono), monospace" },
                },
              }}
            />
          </ActionForm>
        </CardContent>
      </Card>

      {total === 0 ? (
        <Card sx={{ borderStyle: "dashed" }}>
          <CardContent sx={{ textAlign: "center", py: 6 }}>
            <Typography color="text.secondary">
              No requirements stored yet. Use <strong>Sync from Jira</strong> to
              pull them in.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(4, 1fr)" },
              gap: 2,
            }}
          >
            <StatCard label="Requirements" value={total} />
            <StatCard label="Covered (≥80%)" value={fullyCovered} />
            <StatCard label="With failures" value={failing} />
            <StatCard label="No tests" value={gaps} />
          </Box>

          <Card>
            <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Requirement</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Tests</TableCell>
                      <TableCell align="right">Passed</TableCell>
                      <TableCell align="right">Failed</TableCell>
                      <TableCell align="center">Coverage</TableCell>
                      <TableCell>Bugs</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {requirements.map((requirement) => (
                      <TableRow key={requirement.key} hover>
                        <TableCell sx={{ maxWidth: 380 }}>
                          <Stack spacing={0.25}>
                            <a
                              href={requirement.url ?? "#"}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                fontWeight: 600,
                                color: "inherit",
                                textDecoration: "none",
                              }}
                            >
                              {requirement.key}
                            </a>
                            <Typography variant="caption" color="text.secondary">
                              {requirement.summary}
                            </Typography>
                            {requirement.tests.length > 0 ? (
                              <Typography variant="caption" color="text.secondary">
                                {requirement.tests
                                  .slice(0, 6)
                                  .map((test) => `${test.key} (${test.status})`)
                                  .join(" · ")}
                                {requirement.tests.length > 6 ? " …" : ""}
                              </Typography>
                            ) : null}
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption">
                            {requirement.issueType}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption">
                            {requirement.status}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">{requirement.tests.length}</TableCell>
                        <TableCell align="right">{requirement.passed}</TableCell>
                        <TableCell align="right">{requirement.failed}</TableCell>
                        <TableCell align="center">
                          <Chip
                            size="small"
                            label={`${requirement.coverage}%`}
                            color={coverageColor(requirement.coverage)}
                            variant={requirement.coverage > 0 ? "filled" : "outlined"}
                          />
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap" }}>
                            {requirement.bugs.length === 0 ? (
                              <Typography variant="caption" color="text.secondary">
                                —
                              </Typography>
                            ) : (
                              requirement.bugs.map((bug) => (
                                <Chip
                                  key={bug}
                                  size="small"
                                  variant="outlined"
                                  color="error"
                                  label={bug}
                                />
                              ))
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </CardContent>
          </Card>

          <Typography variant="caption" color="text.secondary">
            Requirement links open in Jira
            {data?.siteUrl ? ` (${data.siteUrl.replace("https://", "")})` : ""}.
            {` ${data?.storedCount ?? 0} requirement(s) stored.`}
          </Typography>
        </>
      )}
    </Stack>
  );
}
