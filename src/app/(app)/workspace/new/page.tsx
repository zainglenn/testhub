import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { FormDialog } from "@/components/form-dialog";
import { createWorkspace } from "@/lib/actions/workspace";

export const dynamic = "force-dynamic";

export default function NewWorkspacePage() {
  return (
    <Stack spacing={3} sx={{ maxWidth: 560 }}>
      <Typography variant="h1">New workspace</Typography>
      <Typography color="text.secondary">
        Workspaces are isolated. Projects, test cases, runs, tags and settings
        belong to the workspace you have selected, and you only see workspaces
        you are a member of.
      </Typography>
      <FormDialog
        action={createWorkspace}
        title="Create workspace"
        description="You will be added as the owner and switched to the new workspace."
        triggerLabel="Create workspace"
        submitLabel="Create workspace"
        successMessage="Workspace created"
      >
        <TextField
          name="name"
          label="Name"
          placeholder="Quality Engineering"
          required
        />
      </FormDialog>
    </Stack>
  );
}
