import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { redirect } from "next/navigation";
import { ConfirmButton } from "@/components/confirm-button";
import { FormDialog } from "@/components/form-dialog";
import { createField, deleteField, updateField } from "@/lib/actions/workspace";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { FIELD_TYPES } from "@/lib/validation";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function FieldsPage() {
  if (!(await requireAdmin())) redirect("/projects");
  const workspace = await getWorkspace();

  const fields = await prisma.field.findMany({
    where: { workspaceId: workspace.id },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });

  const form = (field?: {
    name?: string;
    type?: string;
    entity?: string;
    options?: string;
    required?: boolean;
  }) => (
    <>
      <TextField name="name" label="Name" defaultValue={field?.name} required />
      <TextField select name="type" label="Type" defaultValue={field?.type ?? "TEXT"}>
        {FIELD_TYPES.map((type) => (
          <MenuItem key={type} value={type}>
            {type}
          </MenuItem>
        ))}
      </TextField>
      <TextField name="entity" label="Applies to" defaultValue={field?.entity ?? "CASE"} />
      <TextField
        name="options"
        label="Options"
        helperText="For SELECT fields, comma-separated."
        defaultValue={field?.options ?? ""}
      />
      <FormControlLabel
        control={<Checkbox name="required" defaultChecked={field?.required ?? false} />}
        label="Required"
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
          <Typography variant="h1">Fields</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Custom field definitions for your workspace.
          </Typography>
        </Box>
        <FormDialog
          action={createField}
          title="New field"
          triggerLabel="New field"
          submitLabel="Create field"
          successMessage="Field created"
        >
          {form()}
        </FormDialog>
      </Stack>

      <Card>
        <CardContent>
          {fields.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No fields yet.
            </Typography>
          ) : (
            fields.map((field) => (
              <Stack
                key={field.id}
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
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                    <Typography variant="subtitle2">{field.name}</Typography>
                    <Chip size="small" variant="outlined" label={field.type} />
                    {field.required ? (
                      <Chip size="small" color="warning" label="Required" />
                    ) : null}
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {field.entity}
                    {field.options ? ` · ${field.options}` : ""}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                  <FormDialog
                    action={updateField}
                    hidden={{ id: field.id }}
                    title={`Edit ${field.name}`}
                    triggerLabel="Edit"
                    triggerVariant="outlined"
                    submitLabel="Save"
                    successMessage="Field updated"
                  >
                    {form(field)}
                  </FormDialog>
                  <ConfirmButton
                    action={deleteField}
                    hidden={{ id: field.id }}
                    title="Delete field?"
                    description={`Delete "${field.name}"?`}
                    confirmLabel="Delete"
                    iconOnly
                    ariaLabel={`Delete ${field.name}`}
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
