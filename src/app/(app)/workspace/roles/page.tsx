import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { redirect } from "next/navigation";
import { ConfirmButton } from "@/components/confirm-button";
import { FormDialog } from "@/components/form-dialog";
import { createRole, deleteRole, updateRole } from "@/lib/actions/workspace";
import { requireAdmin } from "@/lib/authz";
import { PERMISSION_LABELS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  if (!(await requireAdmin())) redirect("/projects");
  const workspace = await getWorkspace();

  const roles = await prisma.role.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { name: "asc" },
  });

  const fields = (role?: { name?: string; description?: string | null; permissions?: string }) => (
    <>
      <TextField name="name" label="Name" defaultValue={role?.name} required />
      <TextField
        name="description"
        label="Description"
        multiline
        minRows={2}
        defaultValue={role?.description ?? ""}
      />
      <Stack spacing={0.5}>
        <Typography variant="caption" color="text.secondary">
          Permissions
        </Typography>
        {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
          <FormControlLabel
            key={key}
            control={
              <Checkbox
                name="permissions"
                value={key}
                defaultChecked={(role?.permissions ?? "")
                  .split(",")
                  .map((value) => value.trim())
                  .includes(key)}
              />
            }
            label={label}
          />
        ))}
      </Stack>
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
          <Typography variant="h1">Roles</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Roles are enforced across the app via the permission catalog
            (workspace.manage, project.manage, case.manage, run.manage).
          </Typography>
        </Box>
        <FormDialog
          action={createRole}
          title="New role"
          triggerLabel="New role"
          submitLabel="Create role"
          successMessage="Role created"
        >
          {fields()}
        </FormDialog>
      </Stack>

      <Card>
        <CardContent>
          {roles.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No roles yet.
            </Typography>
          ) : (
            roles.map((role) => (
              <Stack
                key={role.id}
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
                  <Typography variant="subtitle2">{role.name}</Typography>
                  {role.description ? (
                    <Typography variant="body2" color="text.secondary">
                      {role.description}
                    </Typography>
                  ) : null}
                  {role.permissions ? (
                    <Typography variant="caption" color="text.secondary">
                      {role.permissions
                        .split(",")
                        .map((value) => value.trim())
                        .filter(Boolean)
                        .map((key) => PERMISSION_LABELS[key] ?? key)
                        .join(" · ")}
                    </Typography>
                  ) : null}
                </Box>
                <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                  <FormDialog
                    action={updateRole}
                    hidden={{ id: role.id }}
                    title={`Edit ${role.name}`}
                    triggerLabel="Edit"
                    triggerVariant="outlined"
                    submitLabel="Save"
                    successMessage="Role updated"
                  >
                    {fields(role)}
                  </FormDialog>
                  <ConfirmButton
                    action={deleteRole}
                    hidden={{ id: role.id }}
                    title="Delete role?"
                    description={`Delete "${role.name}"?`}
                    confirmLabel="Delete"
                    iconOnly
                    ariaLabel={`Delete ${role.name}`}
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
