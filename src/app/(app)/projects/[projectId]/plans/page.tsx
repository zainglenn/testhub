import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormDialog } from "@/components/form-dialog";
import { createTestPlan } from "@/lib/actions/plans";
import { prisma } from "@/lib/prisma";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function ProjectPlansPage(
  props: PageProps<"/projects/[projectId]/plans">,
) {
  const { projectId } = await props.params;

  const workspace = await getWorkspace();
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, key: true, name: true, workspaceId: true },
  });
  if (!project || (project.workspaceId && project.workspaceId !== workspace.id)) {
    notFound();
  }

  const plans = await prisma.testPlan.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { runs: true } } },
  });

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
          <Typography variant="h1">Test plans</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Group runs for a release or milestone and track their progress.
          </Typography>
        </Box>
        <FormDialog
          action={createTestPlan}
          hidden={{ projectId: project.id }}
          title="New test plan"
          description="A plan groups the runs that make up a release or milestone."
          triggerLabel="New plan"
          submitLabel="Create plan"
          successMessage="Plan created"
        >
          <TextField
            name="name"
            label="Plan name"
            placeholder="Release 2.0"
            required
          />
          <TextField name="description" label="Description" multiline minRows={2} />
        </FormDialog>
      </Stack>

      {plans.length === 0 ? (
        <Card sx={{ borderStyle: "dashed" }}>
          <CardContent sx={{ textAlign: "center", py: 8 }}>
            <Typography color="text.secondary">
              No test plans yet. Create one and add runs to it from the Test runs
              page.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" },
            gap: 2,
          }}
        >
          {plans.map((plan) => (
            <Link
              key={plan.id}
              href={`/projects/${project.id}/plans/${plan.id}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <Card
                sx={{
                  height: "100%",
                  transition: "border-color .15s ease, box-shadow .15s ease",
                  "&:hover": { borderColor: "primary.main", boxShadow: 2 },
                }}
              >
                <CardContent>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ justifyContent: "space-between", alignItems: "flex-start" }}
                  >
                    <Typography variant="subtitle1">{plan.name}</Typography>
                    <Chip
                      size="small"
                      label={plan.status}
                      color={plan.status === "COMPLETED" ? "success" : "info"}
                      variant="outlined"
                    />
                  </Stack>
                  {plan.description ? (
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
                      {plan.description}
                    </Typography>
                  ) : null}
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: "block" }}>
                    {plan._count.runs} run{plan._count.runs === 1 ? "" : "s"}
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
