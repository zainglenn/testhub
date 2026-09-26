import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonRemoveOutlinedIcon from "@mui/icons-material/PersonRemoveOutlined";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { redirect } from "next/navigation";
import { ConfirmButton } from "@/components/confirm-button";
import { CopyField } from "@/components/copy-field";
import { FormDialog } from "@/components/form-dialog";
import { MemberRoleSelect } from "@/components/member-role-select";
import { inviteMember, removeMember, revokeInvitation } from "@/lib/actions/members";
import { createUser, deleteUser, revokeUserSessions, updateUser } from "@/lib/actions/users";
import { requirePermission } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const APP_BASE = (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

export default async function UsersPage(props: PageProps<"/workspace/users">) {
  const { invited } = await props.searchParams;
  const session = await requirePermission(PERMISSIONS.WORKSPACE_MANAGE);
  if (!session) {
    redirect("/projects");
  }

  const workspace = await getWorkspace();
  const [roles, memberships] = await Promise.all([
    prisma.role.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.workspaceMember.findMany({
      where: { workspaceId: workspace.id },
      select: { userId: true, roleId: true },
    }),
  ]);

  const users = await prisma.user.findMany({
    where: { id: { in: memberships.map((member) => member.userId) } },
    orderBy: { createdAt: "asc" },
  });

  const roleByUser = new Map(
    memberships.map((member) => [member.userId, member.roleId]),
  );

  const invitations = await prisma.invitation.findMany({
    where: { workspaceId: workspace.id, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    include: { role: { select: { name: true } } },
  });

  const invitedInvitation =
    typeof invited === "string"
      ? await prisma.invitation.findFirst({
          where: { id: invited, workspaceId: workspace.id },
        })
      : null;

  const roleSelect = (defaultValue: string) => (
    <TextField select name="role" label="Role" defaultValue={defaultValue}>
      <MenuItem value="MEMBER">Member</MenuItem>
      <MenuItem value="ADMIN">Admin</MenuItem>
    </TextField>
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
          <Typography variant="h1">Users</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Manage who can access this workspace.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <FormDialog
            action={inviteMember}
            title="Invite member"
            description="Invite someone by email. Existing accounts join immediately; new people receive a join link."
            triggerLabel="Invite member"
            triggerVariant="outlined"
            submitLabel="Create invite"
            successMessage="Invitation created"
          >
            <TextField name="email" type="email" label="Email" required />
            <TextField select name="roleId" label="Role" defaultValue="none">
              <MenuItem value="none">No role</MenuItem>
              {roles.map((role) => (
                <MenuItem key={role.id} value={role.id}>
                  {role.name}
                </MenuItem>
              ))}
            </TextField>
          </FormDialog>
          <FormDialog
            action={createUser}
            title="Add user"
          description="Create an account and set its role."
          triggerLabel="Add user"
          submitLabel="Create user"
          successMessage="User created"
        >
          <TextField name="name" label="Name" required />
          <TextField name="email" type="email" label="Email" required />
          <TextField
            name="password"
            type="password"
            label="Password"
            helperText="At least 8 characters."
            required
          />
          {roleSelect("MEMBER")}
        </FormDialog>
        </Stack>
      </Stack>

      {invitedInvitation ? (
        <Alert severity="success">
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Invitation ready for {invitedInvitation.email}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Share this link — it expires in 7 days. Email delivery is not
            configured, so copy it manually.
          </Typography>
          <Box sx={{ mt: 1.5 }}>
            <CopyField
              value={`${APP_BASE}/invite/${invitedInvitation.token}`}
            />
          </Box>
        </Alert>
      ) : null}

      {invitations.length > 0 ? (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Pending invitations
            </Typography>
            {invitations.map((invitation) => (
              <Stack
                key={invitation.id}
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                sx={{
                  py: 1.5,
                  borderBottom: 1,
                  borderColor: "divider",
                  justifyContent: "space-between",
                  alignItems: { xs: "flex-start", sm: "center" },
                  "&:last-of-type": { borderBottom: 0 },
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2">
                    {invitation.email}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {invitation.role?.name ?? "No role"} · expires{" "}
                    {new Date(invitation.expiresAt).toLocaleDateString()}
                  </Typography>
                </Box>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center", flexShrink: 0, minWidth: 280 }}
                >
                  <CopyField
                    value={`${APP_BASE}/invite/${invitation.token}`}
                  />
                  <ConfirmButton
                    action={revokeInvitation}
                    hidden={{ id: invitation.id }}
                    title="Revoke invitation?"
                    description={`Revoke the invite for ${invitation.email}?`}
                    confirmLabel="Revoke"
                    iconOnly
                    ariaLabel={`Revoke invitation for ${invitation.email}`}
                    icon={<DeleteOutlinedIcon fontSize="small" />}
                  />
                </Stack>
              </Stack>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent>
          {users.map((user) => (
            <Stack
              key={user.id}
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              sx={{
                py: 1.5,
                borderBottom: 1,
                borderColor: "divider",
                justifyContent: "space-between",
                alignItems: { xs: "flex-start", sm: "center" },
                "&:last-of-type": { borderBottom: 0 },
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <Typography variant="subtitle2">{user.name}</Typography>
                  <Chip
                    size="small"
                    label={user.role}
                    color={user.role === "ADMIN" ? "primary" : "default"}
                    variant={user.role === "ADMIN" ? "filled" : "outlined"}
                  />
                  {user.id === session.userId ? (
                    <Typography variant="caption" color="text.secondary">
                      (you)
                    </Typography>
                  ) : null}
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {user.email}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Joined {new Date(user.createdAt).toLocaleDateString()}
                </Typography>
              </Box>

              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: "center", flexShrink: 0 }}
              >
                <MemberRoleSelect
                  userId={user.id}
                  roleId={roleByUser.get(user.id) ?? null}
                  roles={roles}
                />
                <FormDialog
                  action={updateUser}
                  hidden={{ id: user.id }}
                  title={`Edit ${user.name}`}
                  triggerLabel="Edit"
                  triggerVariant="outlined"
                  submitLabel="Save changes"
                  successMessage="User updated"
                >
                  <TextField
                    name="name"
                    label="Name"
                    defaultValue={user.name}
                    required
                  />
                  {roleSelect(user.role)}
                  <TextField
                    name="password"
                    type="password"
                    label="New password"
                    helperText="Leave blank to keep the current password."
                  />
                </FormDialog>
                {user.id !== session.userId ? (
                  <ConfirmButton
                    action={removeMember}
                    hidden={{ userId: user.id }}
                    title="Remove from workspace?"
                    description={`Remove ${user.name} from this workspace? Their account is kept.`}
                    confirmLabel="Remove member"
                    iconOnly
                    ariaLabel={`Remove ${user.name} from workspace`}
                    icon={<PersonRemoveOutlinedIcon fontSize="small" />}
                  />
                ) : null}
                {user.id !== session.userId ? (
                  <ConfirmButton
                    action={revokeUserSessions}
                    hidden={{ userId: user.id }}
                    title="Sign out all sessions?"
                    description={`Sign ${user.name} out of every device?`}
                    confirmLabel="Sign out everywhere"
                    iconOnly
                    ariaLabel={`Sign ${user.name} out everywhere`}
                    icon={<LogoutIcon fontSize="small" />}
                  />
                ) : null}
                {user.id !== session.userId ? (
                  <ConfirmButton
                    action={deleteUser}
                    hidden={{ id: user.id }}
                    title="Delete user?"
                    description={`Remove ${user.name}? Records they created are kept but lose attribution.`}
                    confirmLabel="Delete user"
                    iconOnly
                    ariaLabel={`Delete ${user.name}`}
                    icon={<DeleteOutlinedIcon fontSize="small" />}
                  />
                ) : null}
              </Stack>
            </Stack>
          ))}
        </CardContent>
      </Card>
    </Stack>
  );
}
