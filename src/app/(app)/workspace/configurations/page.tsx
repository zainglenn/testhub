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
  createConfiguration,
  deleteConfiguration,
  updateConfiguration,
} from "@/lib/actions/workspace";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function ConfigurationsPage() {
  if (!(await requireAdmin())) redirect("/projects");
  const workspace = await getWorkspace();

  const configurations = await prisma.configuration.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { name: "asc" },
    include: { _count: { select: { runs: true } } },
  });

  const form = (configuration?: { name?: string; values?: string }) => (
    <>
      <TextField name="name" label="Name" defaultValue={configuration?.name} required />
      <TextField
        name="values"
        label="Values"
        helperText="Comma-separated, e.g. Chrome, Windows 11"
        defaultValue={configuration?.values ?? ""}
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
          <Typography variant="h1">Configurations</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Named test configurations (e.g. browser/OS combinations) for the
            workspace.
          </Typography>
        </Box>
        <FormDialog
          action={createConfiguration}
          title="New configuration"
          triggerLabel="New configuration"
          submitLabel="Create configuration"
          successMessage="Configuration created"
        >
          {form()}
        </FormDialog>
      </Stack>

      <Card>
        <CardContent>
          {configurations.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No configurations yet.
            </Typography>
          ) : (
            configurations.map((configuration) => (
              <Stack
                key={configuration.id}
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
                  <Typography variant="subtitle2">{configuration.name}</Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontFamily: "var(--font-geist-mono), monospace" }}
                  >
                    {configuration.values || "—"} · {configuration._count.runs} run(s)
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                  <FormDialog
                    action={updateConfiguration}
                    hidden={{ id: configuration.id }}
                    title={`Edit ${configuration.name}`}
                    triggerLabel="Edit"
                    triggerVariant="outlined"
                    submitLabel="Save"
                    successMessage="Configuration updated"
                  >
                    {form(configuration)}
                  </FormDialog>
                  <ConfirmButton
                    action={deleteConfiguration}
                    hidden={{ id: configuration.id }}
                    title="Delete configuration?"
                    description={`Delete "${configuration.name}"?`}
                    confirmLabel="Delete"
                    iconOnly
                    ariaLabel={`Delete ${configuration.name}`}
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
