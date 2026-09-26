"use client";

import RestartAltIcon from "@mui/icons-material/RestartAlt";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import { useTransition } from "react";
import { clearRunResult, setRunResult } from "@/lib/actions/runs";
import { EXECUTION_STATUSES } from "@/lib/constants";

const STATUS_COLORS: Record<
  string,
  "success" | "error" | "warning" | "standard"
> = {
  PASS: "success",
  FAIL: "error",
  BLOCKED: "warning",
  SKIPPED: "standard",
};

export function RunResultControl({
  runId,
  testCaseId,
  status,
  disabled = false,
}: {
  runId: string;
  testCaseId: string;
  status: string | null;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const isDisabled = pending || disabled;

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={status}
        disabled={isDisabled}
        onChange={(_event, value: string | null) => {
          if (!value) return;
          startTransition(async () => {
            await setRunResult(runId, testCaseId, value);
          });
        }}
      >
        {EXECUTION_STATUSES.map((executionStatus) => (
          <ToggleButton
            key={executionStatus}
            value={executionStatus}
            color={STATUS_COLORS[executionStatus]}
            sx={{ px: 1.25, py: 0.25, fontSize: 12, lineHeight: 1.4 }}
          >
            {executionStatus}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {status ? (
        <Tooltip title="Clear result">
          <IconButton
            size="small"
            disabled={isDisabled}
            aria-label="Clear result"
            onClick={() =>
              startTransition(async () => {
                await clearRunResult(runId, testCaseId);
              })
            }
          >
            <RestartAltIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : null}
    </Box>
  );
}
