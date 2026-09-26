import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { redirect } from "next/navigation";
import { ConfirmButton } from "@/components/confirm-button";
import { FormDialog } from "@/components/form-dialog";
import {
  createWorkspaceTag,
  deleteWorkspaceTag,
} from "@/lib/actions/workspace";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function WorkspaceTagsPage() {
  if (!(await requireAdmin())) redirect("/projects");
  const workspace = await getWorkspace();

  const tags = await prisma.workspaceTag.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { name: "asc" },
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
          <Typography variant="h1">Tags</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            A workspace-wide tag library. Project tags for cases are managed per
            project.
          </Typography>
        </Box>
        <FormDialog
          action={createWorkspaceTag}
          title="New tag"
          triggerLabel="New tag"
          submitLabel="Create tag"
          successMessage="Tag created"
        >
          <TextField name="name" label="Tag" placeholder="smoke" required />
        </FormDialog>
      </Stack>

      <Card>
        <CardContent>
          {tags.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No tags yet.
            </Typography>
          ) : (
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
              {tags.map((tag) => (
                <Box
                  key={tag.id}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    pl: 1.25,
                    pr: 0.25,
                    py: 0.25,
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 16,
                  }}
                >
                  <Chip size="small" label={tag.name} />
                  <ConfirmButton
                    action={deleteWorkspaceTag}
                    hidden={{ id: tag.id }}
                    title="Delete tag?"
                    description={`Delete "${tag.name}" from the workspace library?`}
                    confirmLabel="Delete"
                    color="inherit"
                    iconOnly
                    ariaLabel={`Delete ${tag.name}`}
                    icon={<DeleteOutlinedIcon sx={{ fontSize: 14 }} />}
                  />
                </Box>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
