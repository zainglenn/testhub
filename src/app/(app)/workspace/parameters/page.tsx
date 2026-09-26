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
  createParameter,
  deleteParameter,
  updateParameter,
} from "@/lib/actions/workspace";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function ParametersPage() {
  if (!(await requireAdmin())) redirect("/projects");
  const workspace = await getWorkspace();

  const parameters = await prisma.parameter.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { name: "asc" },
  });

  const form = (parameter?: { name?: string; values?: string }) => (
    <>
      <TextField name="name" label="Name" defaultValue={parameter?.name} required />
      <TextField
        name="values"
        label="Values"
        helperText="Comma-separated, e.g. Chrome, Firefox, WebKit"
        defaultValue={parameter?.values ?? ""}
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
          <Typography variant="h1">Parameters</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Shared parameter sets for the workspace.
          </Typography>
        </Box>
        <FormDialog
          action={createParameter}
          title="New parameter"
          triggerLabel="New parameter"
          submitLabel="Create parameter"
          successMessage="Parameter created"
        >
          {form()}
        </FormDialog>
      </Stack>

      <Card>
        <CardContent>
          {parameters.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No parameters yet.
            </Typography>
          ) : (
            parameters.map((parameter) => (
              <Stack
                key={parameter.id}
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
                  <Typography variant="subtitle2">{parameter.name}</Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontFamily: "var(--font-geist-mono), monospace" }}
                  >
                    {parameter.values || "—"}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                  <FormDialog
                    action={updateParameter}
                    hidden={{ id: parameter.id }}
                    title={`Edit ${parameter.name}`}
                    triggerLabel="Edit"
                    triggerVariant="outlined"
                    submitLabel="Save"
                    successMessage="Parameter updated"
                  >
                    {form(parameter)}
                  </FormDialog>
                  <ConfirmButton
                    action={deleteParameter}
                    hidden={{ id: parameter.id }}
                    title="Delete parameter?"
                    description={`Delete "${parameter.name}"?`}
                    confirmLabel="Delete"
                    iconOnly
                    ariaLabel={`Delete ${parameter.name}`}
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
