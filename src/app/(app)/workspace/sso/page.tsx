import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { saveSso } from "@/lib/actions/workspace";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function SsoPage() {
  if (!(await requireAdmin())) redirect("/projects");
  const workspace = await getWorkspace();

  const config = await prisma.ssoConfig.findUnique({
    where: { workspaceId: workspace.id },
  });

  return (
    <Box sx={{ maxWidth: 640 }}>
      <Typography variant="h1">Single sign-on</Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
        Configure an OIDC provider for the workspace.
      </Typography>

      <Alert severity={config?.enabled ? "success" : "info"} sx={{ mb: 3 }}>
        {config?.enabled
          ? "SSO is enabled. Set the redirect URI below in your identity provider."
          : "Configure and enable SSO to show a single sign-on button on the login page."}{" "}
        Redirect URI: <strong>{(process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "")}/api/sso/callback</strong>
      </Alert>

      <Card>
        <CardContent>
          <ActionForm
            action={saveSso}
            submitLabel="Save configuration"
            successMessage="SSO settings saved"
          >
            <FormControlLabel
              control={
                <Checkbox name="enabled" defaultChecked={config?.enabled ?? false} />
              }
              label="Enable SSO"
            />
            <TextField
              select
              name="provider"
              label="Provider"
              defaultValue={config?.provider ?? "OIDC"}
            >
              <MenuItem value="OIDC">OIDC</MenuItem>
              <MenuItem value="SAML" disabled>
                SAML (coming soon)
              </MenuItem>
            </TextField>
            <TextField
              name="issuerUrl"
              label="Issuer URL"
              placeholder="https://accounts.example.com"
              defaultValue={config?.issuerUrl ?? ""}
            />
            <TextField
              name="clientId"
              label="Client ID"
              defaultValue={config?.clientId ?? ""}
            />
            <TextField
              name="clientSecret"
              label="Client secret"
              type="password"
              placeholder={config?.clientSecret ? "•••••••• (unchanged)" : ""}
              helperText="Leave blank to keep the current secret. Stored encrypted."
            />
          </ActionForm>
        </CardContent>
      </Card>
    </Box>
  );
}
