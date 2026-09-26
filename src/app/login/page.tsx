import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { AuthLayout } from "@/components/auth-layout";
import { login } from "@/lib/actions/auth";
import { getSession } from "@/lib/auth";
import { getSsoSettings } from "@/lib/sso";

export const dynamic = "force-dynamic";

export default async function LoginPage(props: PageProps<"/login">) {
  const { next, sso: ssoError } = await props.searchParams;
  const nextPath = typeof next === "string" ? next : "";

  const session = await getSession();
  if (session) {
    redirect("/projects");
  }

  const sso = await getSsoSettings();

  return (
    <AuthLayout>
      <Stack spacing={0.5} sx={{ mb: 3 }}>
        <Typography variant="h2">Sign in</Typography>
        <Typography variant="body2" color="text.secondary">
          Welcome back — sign in to your workspace.
        </Typography>
      </Stack>

      <ActionForm
        action={login}
        hidden={{ next: nextPath }}
        submitLabel="Sign in"
      >
        <TextField
          name="email"
          type="email"
          label="Email"
          defaultValue="admin@testhub.dev"
          required
        />
        <TextField
          name="password"
          type="password"
          label="Password"
          defaultValue="admin"
          required
        />
      </ActionForm>

      {typeof ssoError === "string" ? (
        <Alert severity="error" sx={{ mt: 2 }}>
          Single sign-on failed ({ssoError}).
        </Alert>
      ) : null}

      {sso ? (
        <>
          <Divider sx={{ my: 3 }}>or</Divider>
          <Button variant="outlined" fullWidth href="/api/sso/start">
            Sign in with SSO
          </Button>
        </>
      ) : null}
    </AuthLayout>
  );
}
