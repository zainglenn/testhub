import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CaseFilters } from "@/components/case-filters";
import { CaseList, type CaseRow } from "@/components/case-list";
import { CaseModal } from "@/components/case-modal";
import { CasePanel } from "@/components/case-panel";
import {
  CaseGeneralEdit,
  CaseGeneralView,
  CaseJira,
  CaseLinkedIssues,
  CasePanelHeader,
  CaseProperties,
  CaseRuns,
} from "@/components/case-sections";
import { FormDialog } from "@/components/form-dialog";
import { SuitesPanel } from "@/components/suites-panel";
import { createTestCase, importCases } from "@/lib/actions/cases";
import { createSuite } from "@/lib/actions/suites";
import { PRIORITIES } from "@/lib/constants";
import { getJiraConfig, isJiraEnabled } from "@/lib/jira/config";
import { getJiraConnection } from "@/lib/jira/client";
import { prisma } from "@/lib/prisma";
import { viewerHasProjectAccess } from "@/lib/project-access";
import { getWorkspace } from "@/lib/workspace";
import {
  buildSuiteTree,
  flattenSuites,
  withCumulativeCounts,
} from "@/lib/suites";

export const dynamic = "force-dynamic";

export default async function ProjectCasesPage(
  props: PageProps<"/projects/[projectId]/cases">,
) {
  const { projectId } = await props.params;
  const {
    suite: suiteParam,
    q: qParam,
    field: fieldParam,
    priority: priorityParam,
    status: statusParam,
    tag: tagParam,
    case: caseParam,
    modal: modalParam,
    imported: importedParam,
    skipped: skippedParam,
  } = await props.searchParams;

  const activeSuiteId = typeof suiteParam === "string" ? suiteParam : null;
  const query = typeof qParam === "string" ? qParam.trim().toLowerCase() : "";
  const field =
    fieldParam === "TITLE" || fieldParam === "KEY" ? fieldParam : "ALL";
  const priorityFilter = typeof priorityParam === "string" ? priorityParam : "";
  const statusFilter = typeof statusParam === "string" ? statusParam : "";
  const tagFilter = typeof tagParam === "string" ? tagParam : "";

  const workspace = await getWorkspace();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      suites: { orderBy: [{ order: "asc" }, { name: "asc" }] },
      testCases: {
        orderBy: { number: "asc" },
        include: {
          jiraLinks: { select: { id: true } },
          tags: { select: { id: true, name: true } },
          _count: { select: { steps: true } },
        },
      },
      tags: { orderBy: { name: "asc" } },
    },
  });

  if (!project || !(await viewerHasProjectAccess(project, workspace.id))) {
    notFound();
  }

  const suiteTree = buildSuiteTree(project.suites);
  const suiteOptions = flattenSuites(suiteTree);

  const caseCounts = new Map<string, number>();
  for (const testCase of project.testCases) {
    if (testCase.suiteId) {
      caseCounts.set(testCase.suiteId, (caseCounts.get(testCase.suiteId) ?? 0) + 1);
    }
  }
  const treeNodes = withCumulativeCounts(suiteTree, caseCounts);
  const suiteNames = new Map(project.suites.map((suite) => [suite.id, suite.name]));

  const visibleCases = project.testCases.filter((testCase) => {
    if (activeSuiteId && testCase.suiteId !== activeSuiteId) return false;
    if (priorityFilter && testCase.priority !== priorityFilter) return false;
    if (statusFilter && testCase.status !== statusFilter) return false;
    if (tagFilter && !testCase.tags.some((tag) => tag.id === tagFilter)) {
      return false;
    }
    if (query) {
      const key = `${project.key}-${testCase.number}`;
      const haystack =
        field === "KEY"
          ? key
          : field === "TITLE"
            ? testCase.title
            : `${key} ${testCase.title}`;
      if (!haystack.toLowerCase().includes(query)) return false;
    }
    return true;
  });

  const caseRows: CaseRow[] = visibleCases.map((testCase) => ({
    id: testCase.id,
    projectId: project.id,
    key: `${project.key}-${testCase.number}`,
    title: testCase.title,
    suite: testCase.suiteId ? (suiteNames.get(testCase.suiteId) ?? "—") : "—",
    steps: testCase._count.steps,
    jira: testCase.jiraLinks.length,
    status: testCase.status,
    priority: testCase.priority,
  }));

  const filterParams = new URLSearchParams();
  if (typeof qParam === "string" && qParam.trim()) filterParams.set("q", qParam);
  if (field !== "ALL") filterParams.set("field", field);
  if (priorityFilter) filterParams.set("priority", priorityFilter);
  if (statusFilter) filterParams.set("status", statusFilter);
  if (tagFilter) filterParams.set("tag", tagFilter);
  const filterString = filterParams.toString();
  const filterQuery = filterString ? `&${filterString}` : "";
  const filteredCasesHref = `/projects/${project.id}/cases${
    filterString ? `?${filterString}` : ""
  }`;

  const panelParams = new URLSearchParams();
  if (activeSuiteId) panelParams.set("suite", activeSuiteId);
  for (const [key, value] of new URLSearchParams(filterString)) {
    panelParams.set(key, value);
  }
  const panelBase = `/projects/${project.id}/cases${
    panelParams.size > 0 ? `?${panelParams.toString()}` : ""
  }`;

  const caseId = typeof caseParam === "string" ? caseParam : null;
  const modalId = typeof modalParam === "string" ? modalParam : null;
  const detailId = modalId ?? caseId;
  const detailCase = detailId
    ? await prisma.testCase.findUnique({
        where: { id: detailId },
        include: {
          project: {
            include: {
              suites: { orderBy: [{ order: "asc" }, { name: "asc" }] },
            },
          },
          suite: true,
          steps: { orderBy: { order: "asc" } },
          executions: {
            orderBy: { executedAt: "desc" },
            take: 10,
            include: { executedBy: { select: { name: true } } },
          },
          tags: { orderBy: { name: "asc" } },
          jiraLinks: { orderBy: { createdAt: "asc" } },
          createdBy: { select: { name: true } },
          fieldValues: true,
        },
      })
    : null;
  const selectedCase = caseId ? detailCase : null;
  const modalCase = modalId ? detailCase : null;

  const jiraEnabled = isJiraEnabled();
  const jiraConnection = jiraEnabled ? await getJiraConnection() : null;
  const jiraConfig = getJiraConfig();

  const fields = await prisma.field.findMany({
    where: { workspaceId: workspace.id, entity: "CASE" },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
  const sharedSteps = await prisma.sharedStep.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { title: "asc" },
    select: { id: true, title: true },
  });
  const jiraTab = (testCase: NonNullable<typeof detailCase>) => {
    if (jiraEnabled) {
      return (
        <CaseJira
          testCase={testCase}
          connection={jiraConnection}
          configured={jiraConfig.configured}
        />
      );
    }
    if (testCase.jiraLinks.length > 0) {
      return <CaseLinkedIssues testCase={testCase} />;
    }
    return undefined;
  };

  return (
    <Stack spacing={2} sx={{ height: "calc(100vh - 200px)", minHeight: 520 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", md: "center" },
        }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "baseline" }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {project.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {project.testCases.length} cases ({project.testCases.length}) |{" "}
            {project.suites.length} suites ({project.suites.length})
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            href={`/api/projects/${project.id}/cases/export`}
          >
            Export
          </Button>
          <FormDialog
            action={importCases}
            hidden={{ projectId: project.id }}
            title="Import test cases"
            description="Upload a CSV with columns: Title, Suite, Priority, Status, Preconditions, Description, Tags, Steps."
            triggerLabel="Import"
            triggerVariant="outlined"
            submitLabel="Import"
          >
            <input type="file" name="file" accept=".csv,text/csv" required />
            <Typography variant="caption" color="text.secondary">
              Steps use &quot;action =&gt; expected&quot; separated by &quot; |
              &quot;. Suites may be nested with &quot;Parent / Child&quot;.
            </Typography>
          </FormDialog>
          <FormDialog
            action={createSuite}
            hidden={{ projectId: project.id }}
            title="New suite"
            triggerLabel="New suite"
            triggerVariant="outlined"
            submitLabel="Add suite"
            successMessage="Suite added"
          >
            <TextField name="name" label="Suite name" required />
            <TextField select name="parentId" label="Parent" defaultValue="">
              <MenuItem value="">No parent (top level)</MenuItem>
              {suiteOptions.map((option) => (
                <MenuItem key={option.id} value={option.id}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </FormDialog>
          <FormDialog
            action={createTestCase}
            hidden={{ projectId: project.id }}
            title="New test case"
            triggerLabel="New test case"
            submitLabel="Create test case"
            successMessage="Test case created"
          >
            <TextField
              name="title"
              label="Title"
              placeholder="Checkout applies discount code"
              required
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                select
                name="suiteId"
                label="Suite"
                defaultValue={activeSuiteId ?? ""}
              >
                <MenuItem value="">Unassigned</MenuItem>
                {suiteOptions.map((option) => (
                  <MenuItem key={option.id} value={option.id}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                name="priority"
                label="Priority"
                defaultValue="MEDIUM"
              >
                {PRIORITIES.map((priority) => (
                  <MenuItem key={priority} value={priority}>
                    {priority}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          </FormDialog>
        </Stack>
      </Stack>

      {typeof importedParam === "string" ? (
        <Alert severity="success">
          Imported {importedParam} case{importedParam === "1" ? "" : "s"}
          {skippedParam && Number(skippedParam) > 0
            ? `, skipped ${skippedParam}`
            : ""}
          .
        </Alert>
      ) : null}

      <CaseFilters
        q={typeof qParam === "string" ? qParam : ""}
        field={field}
        priority={priorityFilter}
        status={statusFilter}
        tag={tagFilter}
        tags={project.tags}
        activeSuiteId={activeSuiteId}
        resetHref={`/projects/${project.id}/cases`}
      />

      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          flex: 1,
          minHeight: 0,
          border: 1,
          borderColor: "divider",
          borderRadius: 1,
          overflow: "hidden",
          bgcolor: "background.paper",
        }}
      >
        <Box
          sx={{
            width: { xs: "100%", md: 300 },
            flexShrink: 0,
            borderRight: { md: 1 },
            borderBottom: { xs: 1, md: 0 },
            borderColor: "divider",
            maxHeight: { xs: 240, md: "none" },
            minHeight: 0,
          }}
        >
          <SuitesPanel
            projectId={project.id}
            nodes={treeNodes}
            activeId={activeSuiteId}
            filterQuery={filterQuery}
            suiteOptions={suiteOptions}
          />
        </Box>

        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Box
            sx={{
              px: 1.5,
              py: 1,
              borderBottom: 1,
              borderColor: "divider",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
            }}
          >
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "baseline" }}>
              <Link
                href={filteredCasesHref}
                style={{ textDecoration: "none" }}
              >
                <Typography
                  variant="subtitle2"
                  sx={{
                    color: activeSuiteId ? "primary.main" : "text.primary",
                  }}
                >
                  All cases
                </Typography>
              </Link>
              {activeSuiteId ? (
                <>
                  <Typography variant="subtitle2" color="text.secondary">
                    /
                  </Typography>
                  <Typography variant="subtitle2">
                    {suiteNames.get(activeSuiteId) ?? "Suite"}
                  </Typography>
                </>
              ) : null}
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {visibleCases.length} case{visibleCases.length === 1 ? "" : "s"}
            </Typography>
          </Box>

          <Box sx={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
            {visibleCases.length === 0 ? (
              <Box sx={{ p: 6, textAlign: "center" }}>
                <Typography color="text.secondary">
                  No test cases here yet.
                </Typography>
              </Box>
            ) : (
              <CaseList
                rows={caseRows}
                baseHref={panelBase}
                suiteOptions={suiteOptions}
                tags={project.tags}
              />
            )}
          </Box>
        </Box>
      </Box>

      {selectedCase ? (
        <CasePanel
          open
          header={
            <CasePanelHeader testCase={selectedCase} closeHref={panelBase} />
          }
          generalView={<CaseGeneralView testCase={selectedCase} fields={fields} />}
          generalEdit={
            <CaseGeneralEdit
              testCase={selectedCase}
              suiteOptions={suiteOptions}
              fields={fields}
              sharedSteps={sharedSteps}
            />
          }
          properties={<CaseProperties testCase={selectedCase} />}
          runs={<CaseRuns testCase={selectedCase} />}
          jira={jiraTab(selectedCase)}
        />
      ) : null}

      {modalCase ? (
        <CaseModal
          open
          closeHref={panelBase}
          header={<CasePanelHeader testCase={modalCase} closeHref={panelBase} />}
          generalView={<CaseGeneralView testCase={modalCase} fields={fields} />}
          generalEdit={
            <CaseGeneralEdit
              testCase={modalCase}
              suiteOptions={suiteOptions}
              fields={fields}
              sharedSteps={sharedSteps}
            />
          }
          properties={<CaseProperties testCase={modalCase} />}
          runs={<CaseRuns testCase={modalCase} />}
          jira={jiraTab(modalCase)}
        />
      ) : null}
    </Stack>
  );
}
