import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import {
  changePassword,
  revokeSession,
  signOutEverywhere,
} from "@/lib/actions/auth";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const [user, sessions] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.userId } }),
    prisma.session.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!user) {
    redirect("/login");
  }

  return (
    <Stack spacing={3} sx={{ maxWidth: 720 }}>
      <Box>
        <Typography variant="h1">Account</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          Manage your password and active sessions.
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Profile
          </Typography>
          <Stack spacing={1}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Name
              </Typography>
              <Typography variant="body2">{user.name}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Email
              </Typography>
              <Typography variant="body2">{user.email}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Role
              </Typography>
              <Typography variant="body2">{user.role}</Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Change password
          </Typography>
          <ActionForm
            action={changePassword}
            submitLabel="Update password"
            successMessage="Password updated. Other sessions were signed out."
          >
            <TextField
              name="currentPassword"
              type="password"
              label="Current password"
              required
            />
            <TextField
              name="newPassword"
              type="password"
              label="New password"
              helperText="At least 8 characters."
              required
            />
            <TextField
              name="confirmPassword"
              type="password"
              label="Confirm new password"
              required
            />
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack
            direction="row"
            sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}
          >
            <Typography variant="h6">Active sessions</Typography>
            <Box component="form" action={signOutEverywhere}>
              <Button type="submit" size="small" color="error" variant="outlined">
                Sign out everywhere
              </Button>
            </Box>
          </Stack>

          {sessions.map((item, index) => (
            <Stack
              key={item.id}
              direction="row"
              spacing={2}
              sx={{
                py: 1.5,
                borderTop: index === 0 ? 0 : 1,
                borderColor: "divider",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center", mb: 0.25 }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {item.userAgent?.slice(0, 60) ?? "Unknown device"}
                  </Typography>
                  {item.id === session.sessionId ? (
                    <Chip size="small" color="success" label="This device" />
                  ) : null}
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {item.ip ? `${item.ip} · ` : ""}
                  Started {new Date(item.createdAt).toLocaleString()}
                </Typography>
              </Box>
              {item.id === session.sessionId ? null : (
                <Box component="form" action={revokeSession} sx={{ flexShrink: 0 }}>
                  <input type="hidden" name="id" value={item.id} />
                  <Button type="submit" size="small" color="error">
                    Revoke
                  </Button>
                </Box>
              )}
            </Stack>
          ))}
        </CardContent>
      </Card>
    </Stack>
  );
}
