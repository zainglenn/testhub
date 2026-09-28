import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { redirect } from "next/navigation";
import { ConfirmButton } from "@/components/confirm-button";
import { FormDialog } from "@/components/form-dialog";
import {
  createEnvironment,
  deleteEnvironment,
  updateEnvironment,
} from "@/lib/actions/workspace";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function EnvironmentsPage() {
  if (!(await requireAdmin())) redirect("/projects");
  const workspace = await getWorkspace();

  const environments = await prisma.environment.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { name: "asc" },
    include: { _count: { select: { runs: true } } },
  });

  const form = (environment?: { name?: string; description?: string | null }) => (
    <>
      <TextField name="name" label="Name" defaultValue={environment?.name} required />
      <TextField
        name="description"
        label="Description"
        defaultValue={environment?.description ?? ""}
      />
    </>
  );

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
          <Typography variant="h1">Environments</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Named test environments (e.g. QA, Staging, Production) for the
            workspace.
          </Typography>
        </Box>
        <FormDialog
          action={createEnvironment}
          title="New environment"
          triggerLabel="New environment"
          submitLabel="Create environment"
          successMessage="Environment created"
        >
          {form()}
        </FormDialog>
      </Stack>

      <Card>
        <CardContent>
          {environments.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No environments yet.
            </Typography>
          ) : (
            environments.map((environment) => (
              <Stack
                key={environment.id}
                direction="row"
                spacing={2}
                sx={{
                  py: 1.5,
                  borderTop: 1,
                  borderColor: "divider",
                  justifyContent: "space-between",
                  alignItems: "center",
                  "&:first-of-type": { borderTop: 0 },
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2">{environment.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {environment.description || "—"} ·{" "}
                    {environment._count.runs} run(s)
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                  <FormDialog
                    action={updateEnvironment}
                    hidden={{ id: environment.id }}
                    title={`Edit ${environment.name}`}
                    triggerLabel="Edit"
                    triggerVariant="outlined"
                    submitLabel="Save"
                    successMessage="Environment updated"
                  >
                    {form(environment)}
                  </FormDialog>
                  <ConfirmButton
                    action={deleteEnvironment}
                    hidden={{ id: environment.id }}
                    title="Delete environment?"
                    description={`Delete "${environment.name}"? Runs keep their history.`}
                    confirmLabel="Delete"
                    iconOnly
                    ariaLabel={`Delete ${environment.name}`}
                    icon={<DeleteOutlinedIcon fontSize="small" />}
                  />
                </Stack>
              </Stack>
            ))
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
