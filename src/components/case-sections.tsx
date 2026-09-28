import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RefreshIcon from "@mui/icons-material/Refresh";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { ConfirmButton } from "@/components/confirm-button";
import { FormDialog } from "@/components/form-dialog";
import { JiraLinkDialog } from "@/components/jira-link-dialog";
import { PriorityChip, StatusChip } from "@/components/ui";
import {
  addStep,
  deleteStep,
  deleteTestCase,
  insertSharedStep,
  moveStep,
  updateStep,
  updateTestCase,
} from "@/lib/actions/cases";
import { deleteExecution, recordExecution } from "@/lib/actions/executions";
import {
  createBugFromCase,
  refreshCaseLinks,
  refreshIssueLink,
  unlinkIssue,
} from "@/lib/actions/jira";
import { addTagToCase, removeTagFromCase } from "@/lib/actions/tags";
import { setCaseParameters } from "@/lib/actions/case-parameters";
import {
  attachPrecondition,
  detachPrecondition,
} from "@/lib/actions/preconditions";
import {
  CASE_STATUSES,
  EXECUTION_COLORS,
  EXECUTION_STATUSES,
  PRIORITIES,
} from "@/lib/constants";
import type {
  Evidence,
  Field,
  FieldValue,
  JiraIssueLink,
  Precondition,
  PreconditionStep,
  Project,
  Tag,
  TestCase,
  TestCaseParameter,
  TestCasePrecondition,
  TestExecution,
  TestExecutionStep,
  TestStep,
  TestSuite,
  Parameter,
} from "@/generated/prisma/client";

const MONO = "var(--font-geist-mono), monospace";

export type CaseWithRelations = TestCase & {
  project: Project & { suites: TestSuite[] };
  suite: TestSuite | null;
  steps: TestStep[];
  executions: (TestExecution & {
    executedBy: { name: string } | null;
    stepResults: TestExecutionStep[];
    evidence: Evidence[];
  })[];
  tags: Tag[];
  createdBy: { name: string } | null;
  fieldValues: FieldValue[];
  jiraLinks: JiraIssueLink[];
  parameters: (TestCaseParameter & { parameter: Parameter })[];
  preconditions: string | null;
  preconditionLinks: (TestCasePrecondition & {
    precondition: Precondition & { steps: PreconditionStep[] };
  })[];
};

export function CasePanelHeader({
  testCase,
  closeHref,
}: {
  testCase: CaseWithRelations;
  closeHref: string;
}) {
  return (
    <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: "divider" }}>
      <Stack
        direction="row"
        spacing={1}
        sx={{ justifyContent: "space-between", alignItems: "flex-start" }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontFamily: MONO }}
          >
            {testCase.project.key}-{testCase.number}
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
            {testCase.title}
          </Typography>
          <Stack
            direction="row"
            spacing={0.75}
            sx={{ alignItems: "center", mt: 0.5 }}
          >
            <StatusChip status={testCase.status} />
            <PriorityChip priority={testCase.priority} />
            <Typography variant="caption" color="text.secondary">
              {testCase.suite ? testCase.suite.name : "Unassigned"}
            </Typography>
          </Stack>
        </Box>
        <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0 }}>
          <ConfirmButton
            action={deleteTestCase}
            hidden={{ id: testCase.id, projectId: testCase.projectId }}
            title="Delete test case?"
            description="This permanently removes the case, its steps, tags and executions."
            confirmLabel="Delete case"
            iconOnly
            ariaLabel="Delete test case"
            icon={<DeleteOutlinedIcon fontSize="small" />}
          />
          <Tooltip title="Close">
            <Link href={closeHref} style={{ color: "inherit" }}>
              <IconButton size="small" aria-label="Close panel">
                <CloseIcon fontSize="small" />
              </IconButton>
            </Link>
          </Tooltip>
        </Stack>
      </Stack>
    </Box>
  );
}

function Section({
  title,
  value,
}: {
  title: string;
  value: string | null;
}) {
  if (!value) return null;
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" color="text.secondary">
        {title}
      </Typography>
      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", mt: 0.5 }}>
        {value}
      </Typography>
    </Box>
  );
}

export function CaseGeneralView({
  testCase,
  fields,
  preconditionOptions = [],
}: {
  testCase: CaseWithRelations;
  fields: Field[];
  preconditionOptions?: { id: string; name: string }[];
}) {
  return (
    <Box>
      <Section title="Description" value={testCase.description} />
      <Section title="Pre-conditions" value={testCase.preconditions} />
      {fields.length > 0 ? (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
            Fields
          </Typography>
          <Stack spacing={1}>
            {fields.map((field) => {
              const value = testCase.fieldValues.find(
                (item) => item.fieldId === field.id,
              )?.value;
              return (
                <Box key={field.id}>
                  <Typography variant="caption" color="text.secondary">
                    {field.name}
                  </Typography>
                  <Typography variant="body2">{value || "—"}</Typography>
                </Box>
              );
            })}
          </Stack>
        </Box>
      ) : null}
      <Box sx={{ mb: 2 }}>
        <Stack
          direction="row"
          sx={{
            justifyContent: "space-between",
            alignItems: "center",
            mb: 0.5,
          }}
        >
          <Typography variant="subtitle2" color="text.secondary">
            Linked preconditions
          </Typography>
          {preconditionOptions.length > 0 ? (
            <FormDialog
              action={attachPrecondition}
              hidden={{ testCaseId: testCase.id }}
              title="Attach precondition"
              triggerLabel="Attach"
              triggerVariant="outlined"
              submitLabel="Attach precondition"
              successMessage="Precondition attached"
            >
              <TextField
                select
                name="preconditionId"
                label="Precondition"
                defaultValue=""
                required
                fullWidth
              >
                {preconditionOptions.map((option) => (
                  <MenuItem key={option.id} value={option.id}>
                    {option.name}
                  </MenuItem>
                ))}
              </TextField>
            </FormDialog>
          ) : null}
        </Stack>
        {testCase.preconditionLinks.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            None attached.
          </Typography>
        ) : (
          <Stack spacing={0.75}>
            {testCase.preconditionLinks.map((link) => (
              <Box
                key={link.id}
                sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1 }}
              >
                <Stack
                  direction="row"
                  sx={{ justifyContent: "space-between", alignItems: "center" }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {link.precondition.name}
                  </Typography>
                  <ConfirmButton
                    action={detachPrecondition}
                    hidden={{ linkId: link.id }}
                    title="Detach precondition?"
                    description={`Detach "${link.precondition.name}" from this case?`}
                    confirmLabel="Detach"
                    color="inherit"
                    iconOnly
                    ariaLabel="Detach precondition"
                    icon={<DeleteOutlinedIcon sx={{ fontSize: 16 }} />}
                  />
                </Stack>
                {link.precondition.description ? (
                  <Typography variant="caption" color="text.secondary">
                    {link.precondition.description}
                  </Typography>
                ) : null}
                {link.precondition.steps.length > 0 ? (
                  <Stack spacing={0.25} sx={{ mt: 0.5 }}>
                    {link.precondition.steps.map((step, index) => (
                      <Typography
                        key={step.id}
                        variant="caption"
                        color="text.secondary"
                      >
                        {index + 1}. {step.action}
                        {step.expectedResult ? ` → ${step.expectedResult}` : ""}
                      </Typography>
                    ))}
                  </Stack>
                ) : null}
              </Box>
            ))}
          </Stack>
        )}
      </Box>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        Steps
      </Typography>
      {testCase.steps.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No steps yet.
        </Typography>
      ) : (
        <Stack spacing={0.5}>
          {testCase.steps.map((step, index) => (
            <Accordion
              key={step.id}
              disableGutters
              sx={{
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
                "&:before": { display: "none" },
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon fontSize="small" />}
                sx={{ minHeight: 40 }}
              >
                <Typography variant="body2">
                  <Box component="span" sx={{ fontWeight: 700, mr: 1 }}>
                    {index + 1}
                  </Box>
                  {step.action}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ whiteSpace: "pre-wrap" }}
                >
                  {step.expectedResult ?? "No expected result."}
                </Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Stack>
      )}
    </Box>
  );
}

export function CaseGeneralEdit({
  testCase,
  suiteOptions,
  fields,
  sharedSteps,
}: {
  testCase: CaseWithRelations;
  suiteOptions: { id: string; label: string }[];
  fields: Field[];
  sharedSteps: { id: string; title: string }[];
}) {
  return (
    <Stack spacing={3}>
      <ActionForm
        action={updateTestCase}
        hidden={{ id: testCase.id, projectId: testCase.projectId }}
        submitLabel="Save changes"
        successMessage="Changes saved"
      >
        <TextField
          name="title"
          label="Title"
          defaultValue={testCase.title}
          required
        />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            select
            name="status"
            label="Status"
            defaultValue={testCase.status}
          >
            {CASE_STATUSES.map((status) => (
              <MenuItem key={status} value={status}>
                {status}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            name="priority"
            label="Priority"
            defaultValue={testCase.priority}
          >
            {PRIORITIES.map((priority) => (
              <MenuItem key={priority} value={priority}>
                {priority}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
        <TextField
          select
          name="suiteId"
          label="Suite"
          defaultValue={testCase.suiteId ?? ""}
        >
          <MenuItem value="">Unassigned</MenuItem>
          {suiteOptions.map((option) => (
            <MenuItem key={option.id} value={option.id}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          name="preconditions"
          label="Pre-conditions"
          multiline
          minRows={2}
          defaultValue={testCase.preconditions ?? ""}
        />
        <TextField
          name="description"
          label="Description"
          multiline
          minRows={3}
          defaultValue={testCase.description ?? ""}
        />
        {fields.map((field) => {
          const value =
            testCase.fieldValues.find((item) => item.fieldId === field.id)
              ?.value ?? "";
          const name = `field_${field.id}`;

          if (field.type === "CHECKBOX") {
            return (
              <FormControlLabel
                key={field.id}
                control={
                  <>
                    <input type="hidden" name={name} value="" />
                    <Checkbox name={name} value="on" defaultChecked={value === "on"} />
                  </>
                }
                label={field.name}
              />
            );
          }

          if (field.type === "SELECT") {
            return (
              <TextField
                key={field.id}
                select
                name={name}
                label={field.name}
                defaultValue={value}
              >
                <MenuItem value="">—</MenuItem>
                {field.options
                  .split(",")
                  .map((option) => option.trim())
                  .filter(Boolean)
                  .map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
              </TextField>
            );
          }

          return (
            <TextField
              key={field.id}
              name={name}
              label={field.name}
              type={
                field.type === "NUMBER"
                  ? "number"
                  : field.type === "DATE"
                    ? "date"
                    : "text"
              }
              defaultValue={value}
              required={field.required}
            />
          );
        })}
      </ActionForm>

      <Divider />
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: "center", justifyContent: "space-between" }}
      >
        <Typography variant="subtitle2">Steps</Typography>
        {sharedSteps.length > 0 ? (
          <Box
            component="form"
            action={insertSharedStep}
            sx={{ display: "flex", gap: 1, alignItems: "center" }}
          >
            <input type="hidden" name="testCaseId" value={testCase.id} />
            <TextField
              select
              name="sharedStepId"
              label="Insert shared step"
              defaultValue={sharedSteps[0].id}
              sx={{ minWidth: 220 }}
            >
              {sharedSteps.map((shared) => (
                <MenuItem key={shared.id} value={shared.id}>
                  {shared.title}
                </MenuItem>
              ))}
            </TextField>
            <Button type="submit" variant="outlined" sx={{ flexShrink: 0 }}>
              Insert
            </Button>
          </Box>
        ) : null}
      </Stack>
      <Stack spacing={1.5}>
        {testCase.steps.map((step, index) => (
          <Box
            key={step.id}
            sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 }}
          >
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {index + 1}. {step.action}
              </Typography>
              <Stack direction="row" spacing={0.25}>
                <Box component="form" action={moveStep} sx={{ display: "flex" }}>
                  <input type="hidden" name="id" value={step.id} />
                  <input type="hidden" name="direction" value="up" />
                  <IconButton
                    size="small"
                    type="submit"
                    disabled={index === 0}
                    aria-label="Move step up"
                  >
                    <ArrowUpwardIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
                <Box component="form" action={moveStep} sx={{ display: "flex" }}>
                  <input type="hidden" name="id" value={step.id} />
                  <input type="hidden" name="direction" value="down" />
                  <IconButton
                    size="small"
                    type="submit"
                    disabled={index === testCase.steps.length - 1}
                    aria-label="Move step down"
                  >
                    <ArrowDownwardIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
                <ConfirmButton
                  action={deleteStep}
                  hidden={{ id: step.id }}
                  title="Delete step?"
                  description="The step is removed and the rest are renumbered."
                  confirmLabel="Delete step"
                  iconOnly
                  ariaLabel="Delete step"
                  icon={<DeleteOutlinedIcon sx={{ fontSize: 16 }} />}
                />
              </Stack>
            </Stack>
            <ActionForm
              action={updateStep}
              hidden={{ id: step.id, testCaseId: testCase.id }}
              submitLabel="Save step"
              variant="outlined"
              successMessage="Step updated"
            >
              <TextField
                name="action"
                label="Action"
                multiline
                minRows={2}
                defaultValue={step.action}
                required
              />
              <TextField
                name="expectedResult"
                label="Expected result"
                multiline
                minRows={2}
                defaultValue={step.expectedResult ?? ""}
              />
            </ActionForm>
          </Box>
        ))}
      </Stack>
      <ActionForm
        action={addStep}
        hidden={{ testCaseId: testCase.id }}
        submitLabel="Add step"
        variant="outlined"
        successMessage="Step added"
      >
        <TextField name="action" label="Action" multiline minRows={2} required />
        <TextField
          name="expectedResult"
          label="Expected result"
          multiline
          minRows={2}
        />
      </ActionForm>
    </Stack>
  );
}

export function CaseProperties({
  testCase,
  workspaceParameters,
}: {
  testCase: CaseWithRelations;
  workspaceParameters: { id: string; name: string; values: string }[];
}) {
  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="caption" color="text.secondary">
          Key
        </Typography>
        <Typography variant="body2" sx={{ fontFamily: MONO }}>
          {testCase.project.key}-{testCase.number}
        </Typography>
      </Box>
      <Stack direction="row" spacing={1}>
        <StatusChip status={testCase.status} />
        <PriorityChip priority={testCase.priority} />
      </Stack>
      <Box>
        <Typography variant="caption" color="text.secondary">
          Suite
        </Typography>
        <Typography variant="body2">
          {testCase.suite ? testCase.suite.name : "Unassigned"}
        </Typography>
      </Box>
      {testCase.createdBy ? (
        <Box>
          <Typography variant="caption" color="text.secondary">
            Created by
          </Typography>
          <Typography variant="body2">{testCase.createdBy.name}</Typography>
        </Box>
      ) : null}
      <Box>
        <Typography variant="caption" color="text.secondary">
          Created
        </Typography>
        <Typography variant="body2">
          {new Date(testCase.createdAt).toLocaleString()}
        </Typography>
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary">
          Updated
        </Typography>
        <Typography variant="body2">
          {new Date(testCase.updatedAt).toLocaleString()}
        </Typography>
      </Box>

      <Divider />
      <Typography variant="subtitle2">Tags</Typography>
      {testCase.tags.length > 0 ? (
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
          {testCase.tags.map((tag) => (
            <Box
              key={tag.id}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.25,
                pl: 1.25,
                pr: 0.25,
                py: 0.25,
                border: 1,
                borderColor: "divider",
                borderRadius: 16,
              }}
            >
              <Typography variant="caption">{tag.name}</Typography>
              <ConfirmButton
                action={removeTagFromCase}
                hidden={{ testCaseId: testCase.id, tagId: tag.id }}
                title="Remove tag?"
                description={`Remove the "${tag.name}" tag from this case?`}
                confirmLabel="Remove"
                color="inherit"
                iconOnly
                ariaLabel={`Remove tag ${tag.name}`}
                icon={<DeleteOutlinedIcon sx={{ fontSize: 14 }} />}
              />
            </Box>
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          No tags yet.
        </Typography>
      )}
      <ActionForm
        action={addTagToCase}
        hidden={{ testCaseId: testCase.id }}
        submitLabel="Add tag"
        variant="outlined"
        successMessage="Tag added"
      >
        <TextField
          name="name"
          label="Tag"
          placeholder="smoke"
          sx={{ maxWidth: 260 }}
        />
      </ActionForm>

      <Divider />
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center" }}
      >
        <Typography variant="subtitle2">Parameters</Typography>
        <FormDialog
          action={setCaseParameters}
          hidden={{ testCaseId: testCase.id }}
          title="Case parameters"
          description="Attach workspace parameters to make this a data-driven test."
          triggerLabel="Edit parameters"
          triggerVariant="outlined"
          submitLabel="Save parameters"
          successMessage="Parameters updated"
        >
          {workspaceParameters.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No workspace parameters yet. Create them under Workspace →
              Parameters.
            </Typography>
          ) : (
            workspaceParameters.map((parameter) => (
              <FormControlLabel
                key={parameter.id}
                control={
                  <Checkbox
                    name="parameterId"
                    value={parameter.id}
                    defaultChecked={testCase.parameters.some(
                      (entry) => entry.parameterId === parameter.id,
                    )}
                  />
                }
                label={
                  parameter.values
                    ? `${parameter.name} (${parameter.values})`
                    : parameter.name
                }
              />
            ))
          )}
        </FormDialog>
      </Stack>
      {testCase.parameters.length > 0 ? (
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
          {testCase.parameters.map((entry) => (
            <Chip
              key={entry.id}
              size="small"
              variant="outlined"
              label={
                entry.parameter.values
                  ? `${entry.parameter.name}: ${entry.parameter.values}`
                  : entry.parameter.name
              }
            />
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Not parameterized.
        </Typography>
      )}
    </Stack>
  );
}

export function CaseRuns({ testCase }: { testCase: CaseWithRelations }) {
  return (
    <Stack spacing={2}>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center" }}
      >
        <Typography variant="subtitle2">Recent executions</Typography>
        <FormDialog
          action={recordExecution}
          hidden={{ testCaseId: testCase.id }}
          title="Record execution"
          triggerLabel="Record execution"
          triggerVariant="outlined"
          submitLabel="Record execution"
          successMessage="Execution recorded"
        >
          <TextField
            select
            name="status"
            label="Result"
            defaultValue="PASS"
            sx={{ maxWidth: 200 }}
          >
            {EXECUTION_STATUSES.map((status) => (
              <MenuItem key={status} value={status}>
                {status}
              </MenuItem>
            ))}
          </TextField>
          <TextField name="comment" label="Comment" multiline minRows={2} />
          {testCase.parameters.length > 0 ? (
            <TextField
              name="dataset"
              label="Dataset"
              placeholder={
                testCase.parameters
                  .map((entry) => entry.parameter.values)
                  .filter(Boolean)
                  .join(" / ") || "e.g. Chrome"
              }
              helperText="Record a separate result per dataset."
            />
          ) : null}
        </FormDialog>
      </Stack>

      {testCase.executions.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No executions recorded yet.
        </Typography>
      ) : (
        <Stack spacing={1}>
          {testCase.executions.map((execution) => (
            <Box
              key={execution.id}
              sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 }}
            >
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: "center", justifyContent: "space-between" }}
              >
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <Chip
                    size="small"
                    label={execution.status}
                    color={EXECUTION_COLORS[execution.status] ?? "default"}
                  />
                  {execution.dataset ? (
                    <Chip
                      size="small"
                      variant="outlined"
                      label={execution.dataset}
                    />
                  ) : null}
                  <Typography variant="caption" color="text.secondary">
                    {new Date(execution.executedAt).toLocaleString()}
                    {execution.executedBy
                      ? ` · ${execution.executedBy.name}`
                      : ""}
                  </Typography>
                </Stack>
                <ConfirmButton
                  action={deleteExecution}
                  hidden={{ id: execution.id, testCaseId: testCase.id }}
                  title="Delete execution?"
                  description="Remove this recorded result from the case history."
                  confirmLabel="Delete execution"
                  iconOnly
                  ariaLabel="Delete execution"
                  icon={<DeleteOutlinedIcon sx={{ fontSize: 16 }} />}
                />
              </Stack>
              {execution.comment ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.5 }}
                >
                  {execution.comment}
                </Typography>
              ) : null}
              {execution.stepResults.length > 0 ? (
                <Stack
                  direction="row"
                  spacing={0.5}
                  sx={{ mt: 0.75, flexWrap: "wrap", rowGap: 0.5 }}
                >
                  {[...execution.stepResults]
                    .sort((a, b) => a.order - b.order)
                    .map((step, index) => (
                      <Chip
                        key={step.id}
                        size="small"
                        variant="outlined"
                        label={`${index + 1} · ${step.status}`}
                        color={EXECUTION_COLORS[step.status] ?? "default"}
                      />
                    ))}
                  {execution.evidence.map((item) => (
                    <Box
                      key={item.id}
                      component="a"
                      href={`/api/evidence/${item.id}`}
                      target="_blank"
                      rel="noreferrer"
                      sx={{ textDecoration: "none" }}
                    >
                      <Chip
                        size="small"
                        variant="outlined"
                        clickable
                        label={item.filename}
                      />
                    </Box>
                  ))}
                </Stack>
              ) : null}
            </Box>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

export function CaseJira({
  testCase,
  connection,
  configured,
}: {
  testCase: CaseWithRelations;
  connection: { siteUrl: string } | null;
  configured: boolean;
}) {
  const failed =
    testCase.executions.find((execution) => execution.status === "FAIL") ??
    null;
  const latestExecution = testCase.executions[0] ?? null;
  const bugProjectKey = testCase.jiraLinks[0]?.projectKey ?? "";
  const bugSummary = `${testCase.project.key}-${testCase.number}: ${testCase.title}`;
  const bugDescription = [
    `Failing test case: ${testCase.project.key}-${testCase.number} — ${testCase.title}`,
    failed
      ? `Last result: FAIL (${new Date(failed.executedAt).toLocaleString()})`
      : latestExecution
        ? `Latest result: ${latestExecution.status}`
        : "No execution recorded yet.",
    failed?.comment ? `Comment: ${failed.comment}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}
      >
        <Typography variant="subtitle2">Jira issues</Typography>
        {connection ? (
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            {testCase.jiraLinks.length > 0 ? (
              <Box component="form" action={refreshCaseLinks}>
                <input type="hidden" name="testCaseId" value={testCase.id} />
                <Button size="small" type="submit" startIcon={<RefreshIcon />}>
                  Refresh all
                </Button>
              </Box>
            ) : null}
            <FormDialog
              action={createBugFromCase}
              hidden={{ testCaseId: testCase.id }}
              title="Report bug"
              description="Create a Jira bug from this test case and link it automatically."
              triggerLabel="Report bug"
              triggerVariant="outlined"
              submitLabel="Create bug"
              successMessage="Bug created and linked"
            >
              <TextField
                name="projectKey"
                label="Jira project key"
                defaultValue={bugProjectKey}
                placeholder="SCRUM"
                required
              />
              <TextField
                name="issueType"
                label="Issue type"
                defaultValue="Bug"
                required
              />
              <TextField
                name="summary"
                label="Summary"
                defaultValue={bugSummary}
                required
              />
              <TextField
                name="description"
                label="Description"
                defaultValue={bugDescription}
                multiline
                minRows={4}
              />
            </FormDialog>
            <JiraLinkDialog testCaseId={testCase.id} />
          </Stack>
        ) : null}
      </Stack>

      {connection ? (
        testCase.jiraLinks.length > 0 ? (
          <List dense disablePadding>
            {testCase.jiraLinks.map((link) => (
              <ListItem
                key={link.id}
                divider
                alignItems="flex-start"
                secondaryAction={
                  <Stack direction="row" spacing={0.5}>
                    <Box component="form" action={refreshIssueLink}>
                      <input type="hidden" name="id" value={link.id} />
                      <input
                        type="hidden"
                        name="testCaseId"
                        value={testCase.id}
                      />
                      <IconButton
                        size="small"
                        type="submit"
                        aria-label="Refresh from Jira"
                      >
                        <RefreshIcon fontSize="small" />
                      </IconButton>
                    </Box>
                    <Box component="form" action={unlinkIssue}>
                      <input type="hidden" name="id" value={link.id} />
                      <input
                        type="hidden"
                        name="testCaseId"
                        value={testCase.id}
                      />
                      <IconButton
                        size="small"
                        type="submit"
                        aria-label="Unlink issue"
                        color="error"
                      >
                        <DeleteOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Stack>
                }
              >
                <ListItemText
                  primary={
                    <Typography
                      component="a"
                      href={`${connection.siteUrl}/browse/${link.issueKey}`}
                      target="_blank"
                      rel="noreferrer"
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        color: "primary.main",
                        textDecoration: "none",
                      }}
                    >
                      {link.issueKey}
                    </Typography>
                  }
                  secondary={link.summary}
                />
              </ListItem>
            ))}
          </List>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No Jira issues linked yet.
          </Typography>
        )
      ) : (
        <Typography variant="body2" color="text.secondary">
          {configured
            ? "Connect Jira to search and link issues."
            : "Jira OAuth is not configured. Set JIRA_CLIENT_ID and JIRA_CLIENT_SECRET to enable linking."}
        </Typography>
      )}
    </Box>
  );
}

export function CaseLinkedIssues({
  testCase,
}: {
  testCase: CaseWithRelations;
}) {
  return (
    <Stack spacing={1.5}>
      <Box>
        <Typography variant="subtitle2">Linked issues</Typography>
        <Typography variant="caption" color="text.secondary">
          Read-only — Jira linking is disabled.
        </Typography>
      </Box>
      <List dense disablePadding>
        {testCase.jiraLinks.map((link) => (
          <ListItem key={link.id} divider alignItems="flex-start">
            <ListItemText
              primary={
                <Stack
                  direction="row"
                  spacing={1}
                  useFlexGap
                  sx={{ alignItems: "center", flexWrap: "wrap" }}
                >
                  {link.url ? (
                    <Typography
                      component="a"
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        color: "primary.main",
                        textDecoration: "none",
                      }}
                    >
                      {link.issueKey}
                    </Typography>
                  ) : (
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {link.issueKey}
                    </Typography>
                  )}
                  {link.issueType ? (
                    <Chip size="small" variant="outlined" label={link.issueType} />
                  ) : null}
                  {link.status ? <Chip size="small" label={link.status} /> : null}
                </Stack>
              }
              secondary={link.summary}
            />
          </ListItem>
        ))}
      </List>
    </Stack>
  );
}

