import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { ActionForm } from "@/components/action-form";
import { AuthLayout } from "@/components/auth-layout";
import { acceptInvitation } from "@/lib/actions/members";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function isPendingInvitation(
  invitation: { status: string; expiresAt: Date } | null,
): boolean {
  return (
    !!invitation &&
    invitation.status === "PENDING" &&
    invitation.expiresAt.getTime() > Date.now()
  );
}

export default async function InvitePage(props: PageProps<"/invite/[token]">) {
  const { token } = await props.params;

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: {
      workspace: { select: { name: true } },
      role: { select: { name: true } },
    },
  });

  if (!invitation || !isPendingInvitation(invitation)) {
    return (
      <AuthLayout>
        <Stack spacing={2}>
          <Typography variant="h2">Invitation unavailable</Typography>
          <Alert severity="warning">
            This invitation is invalid, has expired, or has already been used.
          </Alert>
          <Button variant="outlined" href="/login">
            Go to sign in
          </Button>
        </Stack>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <Stack spacing={0.5} sx={{ mb: 3 }}>
        <Typography variant="h2">Join {invitation.workspace.name}</Typography>
        <Typography variant="body2" color="text.secondary">
          You were invited as {invitation.role?.name ?? "a member"}. Set your
          name and a password to continue.
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>
          {invitation.email}
        </Typography>
      </Stack>

      <ActionForm
        action={acceptInvitation}
        hidden={{ token }}
        submitLabel="Join workspace"
      >
        <TextField name="name" label="Name" autoComplete="name" required />
        <TextField
          name="password"
          type="password"
          label="Password"
          autoComplete="new-password"
          helperText="At least 8 characters."
          required
        />
      </ActionForm>
    </AuthLayout>
  );
}
