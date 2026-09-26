"use client";

import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { useState, useTransition } from "react";
import {
  bulkUpdateTestCases,
  deleteTestCases,
  type BulkCasePatch,
} from "@/lib/actions/cases";
import {
  CASE_STATUSES,
  PRIORITIES,
  PRIORITY_COLORS,
  STATUS_COLORS,
} from "@/lib/constants";

export type CaseRow = {
  id: string;
  projectId: string;
  key: string;
  title: string;
  suite: string;
  steps: number;
  jira: number;
  status: string;
  priority: string;
};

const MONO = "var(--font-geist-mono), monospace";

export function CaseList({
  rows,
  baseHref,
  suiteOptions,
  tags,
}: {
  rows: CaseRow[];
  baseHref: string;
  suiteOptions: { id: string; label: string }[];
  tags: { id: string; name: string }[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [suiteValue, setSuiteValue] = useState("");
  const [priorityValue, setPriorityValue] = useState("");
  const [statusValue, setStatusValue] = useState("");
  const [tagValue, setTagValue] = useState("");
  const [removeTagValue, setRemoveTagValue] = useState("");

  const allSelected = rows.length > 0 && selected.size === rows.length;

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(rows.map((row) => row.id)));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  const apply = (patch: BulkCasePatch) =>
    startTransition(async () => {
      await bulkUpdateTestCases(Array.from(selected), patch);
    });

  const removeSelected = () =>
    startTransition(async () => {
      await deleteTestCases(Array.from(selected));
      setSelected(new Set());
      setConfirmOpen(false);
    });

  const separator = baseHref.includes("?") ? "&" : "?";

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1,
          py: 0.5,
          borderBottom: 1,
          borderColor: "divider",
          position: "sticky",
          top: 0,
          bgcolor: "background.paper",
          zIndex: 1,
          flexWrap: "wrap",
        }}
      >
        <Checkbox
          size="small"
          checked={allSelected}
          indeterminate={selected.size > 0 && !allSelected}
          onChange={toggleAll}
        />
        {selected.size > 0 ? (
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            sx={{ alignItems: "center", flexWrap: "wrap" }}
          >
            <Typography variant="body2" color="text.secondary">
              {selected.size} selected
            </Typography>
            <Select
              size="small"
              displayEmpty
              value={suiteValue}
              disabled={pending}
              onChange={(event) => {
                const value = event.target.value;
                setSuiteValue("");
                if (value) {
                  apply({ suiteId: value === "__none__" ? null : value });
                }
              }}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="">Move to suite…</MenuItem>
              <MenuItem value="__none__">Unassigned</MenuItem>
              {suiteOptions.map((option) => (
                <MenuItem key={option.id} value={option.id}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
            <Select
              size="small"
              displayEmpty
              value={priorityValue}
              disabled={pending}
              onChange={(event) => {
                const value = event.target.value;
                setPriorityValue("");
                if (value) apply({ priority: value });
              }}
              sx={{ minWidth: 130 }}
            >
              <MenuItem value="">Set priority…</MenuItem>
              {PRIORITIES.map((priority) => (
                <MenuItem key={priority} value={priority}>
                  {priority}
                </MenuItem>
              ))}
            </Select>
            <Select
              size="small"
              displayEmpty
              value={statusValue}
              disabled={pending}
              onChange={(event) => {
                const value = event.target.value;
                setStatusValue("");
                if (value) apply({ status: value });
              }}
              sx={{ minWidth: 130 }}
            >
              <MenuItem value="">Set status…</MenuItem>
              {CASE_STATUSES.map((status) => (
                <MenuItem key={status} value={status}>
                  {status}
                </MenuItem>
              ))}
            </Select>
            {tags.length > 0 ? (
              <Select
                size="small"
                displayEmpty
                value={tagValue}
                disabled={pending}
                onChange={(event) => {
                  const value = event.target.value;
                  setTagValue("");
                  if (value) apply({ addTagId: value });
                }}
                sx={{ minWidth: 130 }}
              >
                <MenuItem value="">Add tag…</MenuItem>
                {tags.map((tag) => (
                  <MenuItem key={tag.id} value={tag.id}>
                    {tag.name}
                  </MenuItem>
                ))}
              </Select>
            ) : null}
            {tags.length > 0 ? (
              <Select
                size="small"
                displayEmpty
                value={removeTagValue}
                disabled={pending}
                onChange={(event) => {
                  const value = event.target.value;
                  setRemoveTagValue("");
                  if (value) apply({ removeTagId: value });
                }}
                sx={{ minWidth: 140 }}
              >
                <MenuItem value="">Remove tag…</MenuItem>
                {tags.map((tag) => (
                  <MenuItem key={tag.id} value={tag.id}>
                    {tag.name}
                  </MenuItem>
                ))}
              </Select>
            ) : null}
            <Button
              size="small"
              color="error"
              startIcon={<DeleteOutlinedIcon />}
              disabled={pending}
              onClick={() => setConfirmOpen(true)}
            >
              Delete
            </Button>
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Name
          </Typography>
        )}
      </Box>

      {rows.map((row) => (
        <Box
          key={row.id}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            px: 1,
            mb: "2px",
            bgcolor: "grey.50",
            borderRadius: 0.5,
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          <DragIndicatorIcon
            sx={{ fontSize: 18, color: "text.disabled", flexShrink: 0 }}
          />
          <Checkbox
            size="small"
            checked={selected.has(row.id)}
            onChange={() => toggle(row.id)}
          />
          <DescriptionOutlinedIcon
            sx={{ fontSize: 16, color: "text.secondary", flexShrink: 0 }}
          />
          <Box
            component={Link}
            href={`${baseHref}${separator}modal=${row.id}`}
            title="Open full details"
            sx={{ textDecoration: "none", flexShrink: 0 }}
          >
            <Typography
              variant="caption"
              sx={{
                fontFamily: MONO,
                color: "primary.main",
                whiteSpace: "nowrap",
                "&:hover": { textDecoration: "underline" },
              }}
            >
              {row.key}
            </Typography>
          </Box>
          <Box
            component={Link}
            href={`${baseHref}${separator}case=${row.id}`}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              flex: 1,
              minWidth: 0,
              py: 0.25,
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <Typography variant="body2" noWrap sx={{ flex: 1 }}>
              {row.title}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: { xs: "none", md: "block" } }}
            >
              {row.steps} step{row.steps === 1 ? "" : "s"}
            </Typography>
            {row.jira > 0 ? (
              <Chip
                size="small"
                variant="outlined"
                label={`${row.jira} Jira`}
                sx={{ display: { xs: "none", md: "flex" } }}
              />
            ) : null}
            <Chip
              size="small"
              label={row.status}
              color={STATUS_COLORS[row.status] ?? "default"}
              variant={row.status === "DRAFT" ? "outlined" : "filled"}
            />
            <Chip
              size="small"
              label={row.priority}
              color={PRIORITY_COLORS[row.priority] ?? "default"}
              variant={row.priority === "LOW" ? "outlined" : "filled"}
            />
          </Box>
        </Box>
      ))}

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          Delete {selected.size} test case{selected.size === 1 ? "" : "s"}?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            This permanently removes the selected cases, their steps, tags and
            executions.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={removeSelected}
            disabled={pending}
          >
            {pending ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
