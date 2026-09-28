"use client";

import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import NoteAltOutlinedIcon from "@mui/icons-material/NoteAltOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { useState, useTransition } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { FormDialog } from "@/components/form-dialog";
import { RunResultControl } from "@/components/run-result-control";
import {
  clearStepResult,
  setStepResult,
  toggleStepResult,
} from "@/lib/actions/executions";
import { deleteEvidence, uploadEvidence } from "@/lib/actions/evidence";
import { EXECUTION_STATUSES } from "@/lib/constants";

const MONO = "var(--font-geist-mono), monospace";

const TOGGLE_COLORS: Record<string, "success" | "error" | "warning" | "standard"> =
  {
    PASS: "success",
    FAIL: "error",
    BLOCKED: "warning",
    SKIPPED: "standard",
  };

type Step = {
  id: string;
  order: number;
  action: string;
  expectedResult: string | null;
};

type StepResult = {
  id: string;
  order: number;
  status: string;
  comment: string | null;
};

type EvidenceItem = {
  id: string;
  filename: string;
  executionStepId: string | null;
};

export function RunCaseRow({
  runId,
  projectId,
  caseKey,
  testCaseId,
  title,
  steps,
  executionId,
  status,
  comment,
  stepResults,
  evidence,
  disabled,
}: {
  runId: string;
  projectId: string;
  caseKey: string;
  testCaseId: string;
  title: string;
  steps: Step[];
  executionId: string | null;
  status: string | null;
  comment: string | null;
  stepResults: StepResult[];
  evidence: EvidenceItem[];
  disabled: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();
  const isDisabled = pending || disabled;

  const resultByOrder = new Map(stepResults.map((r) => [r.order, r]));
  const caseEvidence = evidence.filter((e) => !e.executionStepId);

  function toggle(step: Step, value: string) {
    const formData = new FormData();
    formData.set("runId", runId);
    formData.set("testCaseId", testCaseId);
    formData.set("stepId", step.id);
    formData.set("order", String(step.order));
    formData.set("status", value);
    startTransition(async () => {
      await toggleStepResult(formData);
    });
  }

  function clear(step: Step) {
    const formData = new FormData();
    formData.set("runId", runId);
    formData.set("testCaseId", testCaseId);
    formData.set("order", String(step.order));
    startTransition(async () => {
      await clearStepResult(formData);
    });
  }

  function markAllPassed() {
    startTransition(async () => {
      for (const step of steps) {
        if (resultByOrder.get(step.order)?.status === "PASS") continue;
        const formData = new FormData();
        formData.set("runId", runId);
        formData.set("testCaseId", testCaseId);
        formData.set("stepId", step.id);
        formData.set("order", String(step.order));
        formData.set("status", "PASS");
        await toggleStepResult(formData);
      }
    });
  }

  const hasSteps = steps.length > 0;

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        sx={{
          alignItems: { xs: "flex-start", sm: "center" },
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "baseline" }}>
            <Typography
              variant="body2"
              sx={{ fontFamily: MONO, color: "text.secondary", whiteSpace: "nowrap" }}
            >
              {caseKey}
            </Typography>
            <Link
              href={`/projects/${projectId}/cases?modal=${testCaseId}`}
              style={{ color: "inherit", fontWeight: 500 }}
            >
              {title}
            </Link>
            {hasSteps ? (
              <Tooltip title={`${steps.length} step(s)`}>
                <IconButton
                  size="small"
                  aria-label="Toggle steps"
                  onClick={() => setExpanded((value) => !value)}
                >
                  {expanded ? (
                    <ExpandLessIcon fontSize="small" />
                  ) : (
                    <ExpandMoreIcon fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
            ) : null}
          </Stack>
          {comment ? (
            <Typography variant="caption" color="text.secondary">
              {comment}
            </Typography>
          ) : null}
        </Box>
        <RunResultControl
          runId={runId}
          testCaseId={testCaseId}
          status={status}
          disabled={disabled}
        />
      </Stack>

      {hasSteps ? (
        <Collapse in={expanded} unmountOnExit>
          <Stack
            spacing={1}
            sx={{
              mt: 1.5,
              pl: 1.5,
              borderLeft: 2,
              borderColor: "divider",
            }}
          >
            <Stack
              direction="row"
              spacing={1}
              sx={{ justifyContent: "space-between", alignItems: "center" }}
            >
              <Typography variant="caption" color="text.secondary">
                Steps
              </Typography>
              <Button
                size="small"
                variant="text"
                disabled={isDisabled}
                onClick={markAllPassed}
              >
                Mark all passed
              </Button>
            </Stack>

            {steps.map((step, index) => {
              const result = resultByOrder.get(step.order);
              const stepEvidence = result
                ? evidence.filter((item) => item.executionStepId === result.id)
                : [];
              return (
                <Box
                  key={step.id}
                  sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1 }}
                >
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    sx={{
                      alignItems: { xs: "flex-start", sm: "center" },
                      justifyContent: "space-between",
                      gap: 1,
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2">
                        <Box component="span" sx={{ fontWeight: 700, mr: 1 }}>
                          {index + 1}
                        </Box>
                        {step.action}
                      </Typography>
                      {step.expectedResult ? (
                        <Typography variant="caption" color="text.secondary">
                          Expected: {step.expectedResult}
                        </Typography>
                      ) : null}
                      {result?.comment ? (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: "block" }}
                        >
                          {result.comment}
                        </Typography>
                      ) : null}
                    </Box>

                    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                      <ToggleButtonGroup
                        exclusive
                        size="small"
                        value={result?.status ?? null}
                        disabled={isDisabled}
                        onChange={(_event, value: string | null) => {
                          if (!value) return;
                          toggle(step, value);
                        }}
                      >
                        {EXECUTION_STATUSES.map((stepStatus) => (
                          <ToggleButton
                            key={stepStatus}
                            value={stepStatus}
                            color={TOGGLE_COLORS[stepStatus]}
                            sx={{ px: 1, py: 0.125, fontSize: 11, lineHeight: 1.4 }}
                          >
                            {stepStatus}
                          </ToggleButton>
                        ))}
                      </ToggleButtonGroup>

                      {result ? (
                        <Tooltip title="Clear step result">
                          <span>
                            <IconButton
                              size="small"
                              disabled={isDisabled}
                              aria-label="Clear step result"
                              onClick={() => clear(step)}
                            >
                              <CloseIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </span>
                        </Tooltip>
                      ) : null}
                    </Stack>
                  </Stack>

                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center", mt: 0.5, flexWrap: "wrap" }}
                  >
                    {executionId ? (
                      <>
                        <FormDialog
                          action={setStepResult}
                          title={`Step ${index + 1}`}
                          triggerLabel="Note"
                          triggerVariant="outlined"
                          triggerIcon={<NoteAltOutlinedIcon sx={{ fontSize: 16 }} />}
                          iconOnly
                          hidden={{
                            runId,
                            testCaseId,
                            stepId: step.id,
                            order: String(step.order),
                            status: result?.status ?? "PASS",
                          }}
                          submitLabel="Save"
                          successMessage="Step saved"
                        >
                          <TextField
                            name="comment"
                            label="Comment"
                            multiline
                            minRows={2}
                            defaultValue={result?.comment ?? ""}
                          />
                        </FormDialog>
                        <FormDialog
                          action={uploadEvidence}
                          title={`Evidence for step ${index + 1}`}
                          triggerLabel="Evidence"
                          triggerVariant="outlined"
                          iconOnly
                          triggerIcon={
                            <AddPhotoAlternateOutlinedIcon sx={{ fontSize: 16 }} />
                          }
                          hidden={{
                            executionId,
                            ...(result ? { executionStepId: result.id } : {}),
                          }}
                          submitLabel="Upload"
                          successMessage="Evidence uploaded"
                        >
                          <input type="file" name="file" required />
                        </FormDialog>
                      </>
                    ) : null}

                    {stepEvidence.map((item) => (
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
                </Box>
              );
            })}

            {executionId ? (
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: "center", flexWrap: "wrap" }}
              >
                <FormDialog
                  action={uploadEvidence}
                  title="Case evidence"
                  triggerLabel="Add case evidence"
                  triggerVariant="outlined"
                  hidden={{ executionId }}
                  submitLabel="Upload"
                  successMessage="Evidence uploaded"
                >
                  <input type="file" name="file" required />
                </FormDialog>
                {caseEvidence.map((item) => (
                  <Stack
                    key={item.id}
                    direction="row"
                    spacing={0.25}
                    sx={{ alignItems: "center" }}
                  >
                    <Box
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
                    <ConfirmButton
                      action={deleteEvidence}
                      hidden={{ id: item.id }}
                      title="Delete evidence?"
                      description={`Delete "${item.filename}"?`}
                      confirmLabel="Delete"
                      iconOnly
                      ariaLabel={`Delete ${item.filename}`}
                      icon={<DeleteOutlinedIcon sx={{ fontSize: 16 }} />}
                    />
                  </Stack>
                ))}
              </Stack>
            ) : null}
          </Stack>
        </Collapse>
      ) : null}
    </Box>
  );
}
