import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function AppsPage() {
  return (
    <Stack spacing={3} sx={{ maxWidth: 720 }}>
      <Box>
        <Typography variant="h1">Apps</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          Integrations that connect TestHub to the rest of your toolchain.
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Typography variant="h6">Jira Cloud</Typography>
            <Chip size="small" label="Feature-flagged" variant="outlined" />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Link test cases to Jira issues and trace coverage. Enable with{" "}
            <code>JIRA_ENABLED</code>.
          </Typography>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6">API tokens &amp; CI ingestion</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Tokens are per project. Create one under a project&apos;s{" "}
            <strong>Settings → API tokens</strong>, then POST JUnit XML to{" "}
            <code>/api/ingest</code>.
          </Typography>
          <Box sx={{ mt: 1.5 }}>
            <Link href="/projects" style={{ color: "inherit", fontWeight: 600 }}>
              Open a project →
            </Link>
          </Box>
        </CardContent>
      </Card>
    </Stack>
  );
}
