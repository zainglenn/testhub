import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { ConfirmButton } from "@/components/confirm-button";
import { CreateTokenForm } from "@/components/create-token-form";
import { FormDialog } from "@/components/form-dialog";
import {
  addProjectMember,
  removeProjectMember,
  setProjectRestricted,
} from "@/lib/actions/project-access";
import { deleteProject, updateProject, updateProjectJira } from "@/lib/actions/projects";
import { deleteApiToken } from "@/lib/actions/tokens";
import { deleteTag, renameTag } from "@/lib/actions/tags";
import { prisma } from "@/lib/prisma";
import { viewerHasProjectAccess } from "@/lib/project-access";
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

  if (!project || !(await viewerHasProjectAccess(project, workspace.id))) {
    notFound();
  }

  const [workspaceMembers, projectMemberRows] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { workspaceId: workspace.id },
      select: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.projectMember.findMany({
      where: { projectId: project.id },
      select: { userId: true },
    }),
  ]);
  const projectMemberIds = new Set(projectMemberRows.map((row) => row.userId));
  const allMembers = workspaceMembers.map((row) => row.user);
  const projectMembers = allMembers.filter((user) => projectMemberIds.has(user.id));
  const memberCandidates = allMembers.filter((user) => !projectMemberIds.has(user.id));

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
            Access
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Restrict this project to specific workspace members. Administrators
            and project managers always have access.
          </Typography>
          <Box component="form" action={setProjectRestricted}>
            <input type="hidden" name="id" value={project.id} />
            <FormControlLabel
              control={
                <Checkbox name="restricted" defaultChecked={project.restricted} />
              }
              label="Restrict access to members"
            />
            <Box sx={{ mt: 1 }}>
              <Button type="submit" variant="outlined" size="small">
                Save access
              </Button>
            </Box>
          </Box>

          {project.restricted ? (
            <Box sx={{ mt: 2 }}>
              <Stack
                direction="row"
                sx={{
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 1,
                }}
              >
                <Typography variant="subtitle2">Members</Typography>
                {memberCandidates.length > 0 ? (
                  <FormDialog
                    action={addProjectMember}
                    hidden={{ projectId: project.id }}
                    title="Add member"
                    description="Grant a workspace member access to this project."
                    triggerLabel="Add member"
                    triggerVariant="outlined"
                    submitLabel="Add member"
                    successMessage="Member added"
                  >
                    <TextField select name="userId" label="Member" defaultValue="" required>
                      {memberCandidates.map((user) => (
                        <MenuItem key={user.id} value={user.id}>
                          {user.name}
                        </MenuItem>
                      ))}
                    </TextField>
                  </FormDialog>
                ) : null}
              </Stack>
              {projectMembers.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No members yet.
                </Typography>
              ) : (
                projectMembers.map((user) => (
                  <Stack
                    key={user.id}
                    direction="row"
                    sx={{
                      justifyContent: "space-between",
                      alignItems: "center",
                      py: 0.5,
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2">{user.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {user.email}
                      </Typography>
                    </Box>
                    <ConfirmButton
                      action={removeProjectMember}
                      hidden={{ projectId: project.id, userId: user.id }}
                      title="Remove member?"
                      description={`Remove ${user.name} from this project?`}
                      confirmLabel="Remove"
                      iconOnly
                      ariaLabel={`Remove ${user.name}`}
                      icon={<DeleteOutlinedIcon fontSize="small" />}
                    />
                  </Stack>
                ))
              )}
            </Box>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Jira status write-back
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Optionally move linked Jira issues when a result is recorded. Enter
            the target <strong>status name</strong> (e.g. <em>Done</em>,{" "}
            <em>In Progress</em>); leave blank to disable.
          </Typography>
          <ActionForm
            action={updateProjectJira}
            hidden={{ id: project.id }}
            submitLabel="Save write-back"
            successMessage="Write-back updated"
          >
            <TextField
              name="jiraProjectKey"
              label="Jira project key"
              placeholder="SCRUM"
              defaultValue={project.jiraProjectKey ?? ""}
              helperText="Ties this project to a Jira project for the embedded panel."
            />
            <TextField
              name="jiraPassStatus"
              label="On PASS → status"
              placeholder="Done"
              defaultValue={project.jiraPassStatus ?? ""}
            />
            <TextField
              name="jiraFailStatus"
              label="On FAIL → status"
              placeholder="Reopen"
              defaultValue={project.jiraFailStatus ?? ""}
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
