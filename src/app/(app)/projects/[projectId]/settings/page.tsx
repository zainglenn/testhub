import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { ConfirmButton } from "@/components/confirm-button";
import { CreateTokenForm } from "@/components/create-token-form";
import { FormDialog } from "@/components/form-dialog";
import { deleteProject, updateProject } from "@/lib/actions/projects";
import { deleteApiToken } from "@/lib/actions/tokens";
import { deleteTag, renameTag } from "@/lib/actions/tags";
import { prisma } from "@/lib/prisma";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function ProjectSettingsPage(
  props: PageProps<"/projects/[projectId]/settings">,
) {
  const { projectId } = await props.params;

  const workspace = await getWorkspace();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      _count: { select: { testCases: true, suites: true, runs: true } },
      apiTokens: { orderBy: { createdAt: "desc" } },
      tags: {
        orderBy: { name: "asc" },
        include: { _count: { select: { testCases: true } } },
      },
    },
  });

  if (!project || (project.workspaceId && project.workspaceId !== workspace.id)) {
    notFound();
  }

  return (
    <Stack spacing={3} sx={{ maxWidth: 720 }}>
      <Box>
        <Typography variant="h1">Project settings</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          Manage {project.name}&apos;s details.
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            General
          </Typography>
          <ActionForm
            action={updateProject}
            hidden={{ id: project.id }}
            submitLabel="Save changes"
            successMessage="Project updated"
          >
            <TextField
              label="Key"
              value={project.key}
              disabled
              slotProps={{ htmlInput: { readOnly: true } }}
              helperText="The key prefixes every test case and cannot be changed."
            />
            <TextField
              name="name"
              label="Name"
              defaultValue={project.name}
              required
            />
            <TextField
              name="description"
              label="Description"
              multiline
              minRows={3}
              defaultValue={project.description ?? ""}
            />
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>
            API tokens
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Push automated results to{" "}
            <Box
              component="code"
              sx={{ fontFamily: "var(--font-geist-mono), monospace" }}
            >
              POST /api/ingest
            </Box>{" "}
            with a JUnit report, authenticated via{" "}
            <Box
              component="code"
              sx={{ fontFamily: "var(--font-geist-mono), monospace" }}
            >
              Authorization: Bearer &lt;token&gt;
            </Box>
            .
          </Typography>

          <CreateTokenForm projectId={project.id} />

          {project.apiTokens.length > 0 ? (
            <Box sx={{ mt: 2 }}>
              {project.apiTokens.map((token) => (
                <Stack
                  key={token.id}
                  direction="row"
                  spacing={1}
                  sx={{
                    py: 1,
                    borderTop: 1,
                    borderColor: "divider",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2">{token.name}</Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontFamily: "var(--font-geist-mono), monospace" }}
                    >
                      {token.prefix}…
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block" }}
                    >
                      Created {new Date(token.createdAt).toLocaleDateString()}
                      {token.lastUsedAt
                        ? ` · Last used ${new Date(token.lastUsedAt).toLocaleString()}`
                        : " · Never used"}
                    </Typography>
                  </Box>
                  <ConfirmButton
                    action={deleteApiToken}
                    hidden={{ id: token.id }}
                    title="Revoke token?"
                    description={`Revoke "${token.name}"? Integrations using it will stop working.`}
                    confirmLabel="Revoke"
                    iconOnly
                    ariaLabel={`Revoke ${token.name}`}
                    icon={<DeleteOutlinedIcon fontSize="small" />}
                  />
                </Stack>
              ))}
            </Box>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Tags
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Rename or remove tags across this project. Add tags from any test
            case.
          </Typography>
          {project.tags.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No tags yet.
            </Typography>
          ) : (
            <List dense disablePadding>
              {project.tags.map((tag) => (
                <ListItem
                  key={tag.id}
                  divider
                  secondaryAction={
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <FormDialog
                        action={renameTag}
                        hidden={{ id: tag.id }}
                        title="Rename tag"
                        triggerLabel="Rename"
                        submitLabel="Save"
                        triggerVariant="outlined"
                        successMessage="Tag renamed"
                      >
                        <TextField
                          name="name"
                          label="Tag name"
                          defaultValue={tag.name}
                          required
                        />
                      </FormDialog>
                      <ConfirmButton
                        action={deleteTag}
                        hidden={{ id: tag.id }}
                        title="Delete tag?"
                        description={`Remove the "${tag.name}" tag from all ${tag._count.testCases} case(s)?`}
                        confirmLabel="Delete tag"
                        iconOnly
                        ariaLabel={`Delete tag ${tag.name}`}
                        icon={<DeleteOutlinedIcon fontSize="small" />}
                      />
                    </Stack>
                  }
                >
                  <ListItemText
                    primary={tag.name}
                    secondary={`${tag._count.testCases} case${tag._count.testCases === 1 ? "" : "s"}`}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      <Card sx={{ borderColor: "error.main" }}>
        <CardContent>
          <Typography variant="h6" color="error" sx={{ mb: 1 }}>
            Danger zone
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Deleting this project permanently removes its{" "}
            {project._count.testCases} test cases, {project._count.suites} suites
            and {project._count.runs} runs.
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <ConfirmButton
            action={deleteProject}
            hidden={{ id: project.id }}
            title="Delete project?"
            description={`This permanently removes ${project.name} and all of its test cases, suites and runs. This cannot be undone.`}
            confirmLabel="Delete project"
            label="Delete project"
          />
        </CardContent>
      </Card>
    </Stack>
  );
}
