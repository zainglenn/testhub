import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

export default function NotFound() {
  return (
    <Stack spacing={2} sx={{ alignItems: "center", py: 12, textAlign: "center" }}>
      <Typography variant="overline" color="text.secondary">
        404
      </Typography>
      <Typography variant="h2">Not found</Typography>
      <Typography color="text.secondary">
        The page or record you are looking for does not exist.
      </Typography>
      <Button variant="outlined" href="/projects">
        Back to projects
      </Button>
    </Stack>
  );
}
