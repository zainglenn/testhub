import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { FormDialog } from "@/components/form-dialog";
import { createProject } from "@/lib/actions/projects";
import { plural } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { projectAccessContext, visibleProjectWhere } from "@/lib/project-access";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const workspace = await getWorkspace();
  const access = await projectAccessContext();
  const projects = await prisma.project.findMany({
    where: {
      workspaceId: workspace.id,
      ...visibleProjectWhere(access?.userId ?? "", access?.canManageAll ?? false),
    },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { testCases: true, suites: true, runs: true } } },
  });

  return (
    <Stack spacing={4}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", sm: "center" },
        }}
      >
        <Box>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <Typography variant="h1">Projects</Typography>
            <Chip
              size="small"
              variant="outlined"
              label={plural(projects.length, "project")}
            />
          </Stack>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Pick a project to open its test repository and runs.
          </Typography>
        </Box>
        <FormDialog
          action={createProject}
          title="Create project"
          description="Projects group suites, test cases and runs. The key prefixes every test case."
          triggerLabel="Create project"
          submitLabel="Create project"
          successMessage="Project created"
        >
          <TextField
            name="key"
            label="Key"
                placeholder="EPP"
                required
                helperText="Uppercase letters and numbers, e.g. EPP."
            slotProps={{
              htmlInput: {
                maxLength: 12,
                style: { textTransform: "uppercase" },
              },
            }}
          />
          <TextField
            name="name"
            label="Name"
            placeholder="Shop checkout"
            required
          />
          <TextField
            name="description"
            label="Description"
            multiline
            minRows={3}
          />
        </FormDialog>
      </Stack>

      {projects.length === 0 ? (
        <Card sx={{ borderStyle: "dashed" }}>
          <CardContent sx={{ textAlign: "center", py: 8 }}>
            <Typography color="text.secondary">
              No projects yet. Use <strong>Create project</strong> to get started.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, 1fr)",
              lg: "repeat(3, 1fr)",
            },
            gap: 3,
          }}
        >
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <Card
                sx={{
                  height: "100%",
                  display: "flex",
                  transition: "border-color .15s ease, box-shadow .15s ease",
                  "&:hover": {
                    borderColor: "primary.main",
                    boxShadow: 2,
                  },
                }}
              >
                <CardContent
                  sx={{ display: "flex", flexDirection: "column", gap: 1.5, flexGrow: 1 }}
                >
                  <Chip
                    size="small"
                    color="primary"
                    variant="outlined"
                    label={project.key}
                    sx={{ alignSelf: "flex-start" }}
                  />
                  <Typography variant="h6" component="h2">
                    {project.name}
                  </Typography>
                  {project.description ? (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        flexGrow: 1,
                      }}
                    >
                      {project.description}
                    </Typography>
                  ) : (
                    <Box sx={{ flexGrow: 1 }} />
                  )}
                  <Stack
                    direction="row"
                    spacing={2}
                    sx={{ color: "text.secondary" }}
                  >
                    <Typography variant="caption">
                      {plural(project._count.testCases, "test case")}
                    </Typography>
                    <Typography variant="caption">
                      {plural(project._count.suites, "suite")}
                    </Typography>
                    <Typography variant="caption">
                      {plural(project._count.runs, "run")}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Link>
          ))}
        </Box>
      )}
    </Stack>
  );
}
