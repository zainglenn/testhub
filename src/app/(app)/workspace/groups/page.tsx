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
import { createGroup, deleteGroup, updateGroup } from "@/lib/actions/workspace";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  if (!(await requireAdmin())) redirect("/projects");
  const workspace = await getWorkspace();

  const groups = await prisma.group.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { name: "asc" },
    include: { _count: { select: { members: true } } },
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
          <Typography variant="h1">Groups</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Organise members into groups.
          </Typography>
        </Box>
        <FormDialog
          action={createGroup}
          title="New group"
          triggerLabel="New group"
          submitLabel="Create group"
          successMessage="Group created"
        >
          <TextField name="name" label="Name" required />
          <TextField name="description" label="Description" multiline minRows={2} />
        </FormDialog>
      </Stack>

      <Card>
        <CardContent>
          {groups.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No groups yet.
            </Typography>
          ) : (
            groups.map((group) => (
              <Stack
                key={group.id}
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
                  <Typography variant="subtitle2">{group.name}</Typography>
                  {group.description ? (
                    <Typography variant="body2" color="text.secondary">
                      {group.description}
                    </Typography>
                  ) : null}
                  <Typography variant="caption" color="text.secondary">
                    {group._count.members} member
                    {group._count.members === 1 ? "" : "s"}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                  <FormDialog
                    action={updateGroup}
                    hidden={{ id: group.id }}
                    title={`Edit ${group.name}`}
                    triggerLabel="Edit"
                    triggerVariant="outlined"
                    submitLabel="Save"
                    successMessage="Group updated"
                  >
                    <TextField name="name" label="Name" defaultValue={group.name} required />
                    <TextField
                      name="description"
                      label="Description"
                      multiline
                      minRows={2}
                      defaultValue={group.description ?? ""}
                    />
                  </FormDialog>
                  <ConfirmButton
                    action={deleteGroup}
                    hidden={{ id: group.id }}
                    title="Delete group?"
                    description={`Delete "${group.name}"? Members are not removed from the workspace.`}
                    confirmLabel="Delete"
                    iconOnly
                    ariaLabel={`Delete ${group.name}`}
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
