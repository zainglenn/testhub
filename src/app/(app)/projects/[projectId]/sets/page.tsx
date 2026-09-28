import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/confirm-button";
import { FormDialog } from "@/components/form-dialog";
import {
  addCaseToTestSet,
  createTestSet,
  deleteTestSet,
  removeCaseFromTestSet,
  updateTestSet,
} from "@/lib/actions/test-sets";
import { prisma } from "@/lib/prisma";
import { viewerHasProjectAccess } from "@/lib/project-access";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function TestSetsPage(
  props: PageProps<"/projects/[projectId]/sets">,
) {
  const { projectId } = await props.params;
  const workspace = await getWorkspace();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, key: true, name: true, workspaceId: true, restricted: true },
  });
  if (!project || !(await viewerHasProjectAccess(project, workspace.id))) {
    notFound();
  }

  const [testSets, cases] = await Promise.all([
    prisma.testSet.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
      include: {
        items: {
          orderBy: { order: "asc" },
          include: {
            testCase: {
              select: { id: true, number: true, title: true, suite: { select: { name: true } } },
            },
          },
        },
      },
    }),
    prisma.testCase.findMany({
      where: { projectId },
      orderBy: { number: "asc" },
      select: { id: true, number: true, title: true },
    }),
  ]);

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
          <Typography variant="h1">Test sets</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 680 }}>
            Group test cases into reusable sets and run them together from{" "}
            <Link href={`/projects/${project.id}/runs`}>Test runs</Link>.
          </Typography>
        </Box>
        <FormDialog
          action={createTestSet}
          hidden={{ projectId: project.id }}
          title="New test set"
          triggerLabel="New test set"
          submitLabel="Create test set"
          successMessage="Test set created"
        >
          <TextField name="name" label="Name" required />
          <TextField name="description" label="Description" multiline minRows={2} />
        </FormDialog>
      </Stack>

      {testSets.length === 0 ? (
        <Card sx={{ borderStyle: "dashed" }}>
          <CardContent sx={{ textAlign: "center", py: 6 }}>
            <Typography color="text.secondary">
              No test sets yet. Create one and add cases to group a regression
              suite.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        testSets.map((testSet) => {
          const memberIds = new Set(testSet.items.map((item) => item.testCaseId));
          const candidates = cases.filter((testCase) => !memberIds.has(testCase.id));
          return (
            <Card key={testSet.id}>
              <CardContent>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h6">{testSet.name}</Typography>
                    {testSet.description ? (
                      <Typography variant="body2" color="text.secondary">
                        {testSet.description}
                      </Typography>
                    ) : null}
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`${testSet.items.length} case(s)`}
                      sx={{ mt: 0.5 }}
                    />
                  </Box>
                  <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                    <FormDialog
                      action={updateTestSet}
                      hidden={{ id: testSet.id }}
                      title={`Edit ${testSet.name}`}
                      triggerLabel="Edit"
                      triggerVariant="outlined"
                      submitLabel="Save"
                      successMessage="Test set updated"
                    >
                      <TextField name="name" label="Name" defaultValue={testSet.name} required />
                      <TextField
                        name="description"
                        label="Description"
                        multiline
                        minRows={2}
                        defaultValue={testSet.description ?? ""}
                      />
                    </FormDialog>
                    {candidates.length > 0 ? (
                      <FormDialog
                        action={addCaseToTestSet}
                        hidden={{ testSetId: testSet.id }}
                        title={`Add a case to ${testSet.name}`}
                        triggerLabel="Add case"
                        triggerVariant="outlined"
                        submitLabel="Add case"
                        successMessage="Case added"
                      >
                        <TextField
                          select
                          name="testCaseId"
                          label="Test case"
                          defaultValue={candidates[0]?.id ?? ""}
                        >
                          {candidates.map((testCase) => (
                            <MenuItem key={testCase.id} value={testCase.id}>
                              {`${project.key}-${testCase.number} ${testCase.title}`}
                            </MenuItem>
                          ))}
                        </TextField>
                      </FormDialog>
                    ) : null}
                    <ConfirmButton
                      action={deleteTestSet}
                      hidden={{ id: testSet.id }}
                      title="Delete test set?"
                      description={`Delete "${testSet.name}"? The cases themselves are not deleted.`}
                      confirmLabel="Delete"
                      iconOnly
                      ariaLabel={`Delete ${testSet.name}`}
                      icon={<DeleteOutlinedIcon fontSize="small" />}
                    />
                  </Stack>
                </Stack>

                {testSet.items.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No cases in this set yet.
                  </Typography>
                ) : (
                  <Stack spacing={0.5}>
                    {testSet.items.map((item) => (
                      <Stack
                        key={item.id}
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: "center", justifyContent: "space-between" }}
                      >
                        <Typography variant="body2">
                          <Box
                            component="span"
                            sx={{
                              fontFamily: "var(--font-geist-mono), monospace",
                              color: "text.secondary",
                              mr: 1,
                            }}
                          >
                            {project.key}-{item.testCase.number}
                          </Box>
                          <Link
                            href={`/projects/${project.id}/cases?modal=${item.testCase.id}`}
                            style={{ color: "inherit" }}
                          >
                            {item.testCase.title}
                          </Link>
                          {item.testCase.suite ? (
                            <Typography
                              component="span"
                              variant="caption"
                              color="text.secondary"
                            >
                              {" "}
                              · {item.testCase.suite.name}
                            </Typography>
                          ) : null}
                        </Typography>
                        <ConfirmButton
                          action={removeCaseFromTestSet}
                          hidden={{ id: item.id }}
                          title="Remove case?"
                          description="Remove this case from the set?"
                          confirmLabel="Remove"
                          color="inherit"
                          iconOnly
                          ariaLabel="Remove case"
                          icon={<DeleteOutlinedIcon sx={{ fontSize: 16 }} />}
                        />
                      </Stack>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </Stack>
  );
}
