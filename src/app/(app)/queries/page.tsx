import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

export const dynamic = "force-dynamic";

export default function QueriesPage() {
  return (
    <Box sx={{ maxWidth: 640 }}>
      <Typography variant="h1">Queries</Typography>
      <Typography color="text.secondary" sx={{ mt: 1 }}>
        Saved queries are coming soon — reusable, shareable filters across test
        cases and runs.
      </Typography>
      <Button variant="outlined" href="/projects" sx={{ mt: 3 }}>
        Go to projects
      </Button>
    </Box>
  );
}
