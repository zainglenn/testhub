"use client";

import AddIcon from "@mui/icons-material/Add";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CreateNewFolderOutlinedIcon from "@mui/icons-material/CreateNewFolderOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { useState } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { FormDialog } from "@/components/form-dialog";
import { createSuite, deleteSuite, moveSuite } from "@/lib/actions/suites";
import type { SuiteTreeNode } from "@/lib/suites";

function collectIds(nodes: SuiteTreeNode[]): string[] {
  return nodes.flatMap((node) => [node.id, ...collectIds(node.children)]);
}

export function SuitesPanel({
  projectId,
  nodes,
  activeId,
  filterQuery,
  suiteOptions,
}: {
  projectId: string;
  nodes: SuiteTreeNode[];
  activeId: string | null;
  filterQuery: string;
  suiteOptions: { id: string; label: string }[];
}) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(collectIds(nodes)),
  );

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  const renderNodes = (list: SuiteTreeNode[], depth: number) =>
    list.map((node, index) => {
      const hasChildren = node.children.length > 0;
      const isOpen = expanded.has(node.id);
      const selected = node.id === activeId;
      return (
        <Box key={node.id}>
          <Box
            className="suite-row"
            sx={{
              display: "flex",
              alignItems: "center",
              borderRadius: 1,
              bgcolor: selected ? "action.selected" : "transparent",
              "&:hover": {
                bgcolor: selected ? "action.selected" : "action.hover",
              },
              "&:hover .suite-actions": { opacity: 1 },
            }}
          >
            <Box
              sx={{
                width: 24,
                flexShrink: 0,
                display: "flex",
                justifyContent: "center",
              }}
            >
              {hasChildren ? (
                <IconButton
                  size="small"
                  sx={{ p: 0.25 }}
                  aria-label={isOpen ? "Collapse suite" : "Expand suite"}
                  onClick={() => toggle(node.id)}
                >
                  {isOpen ? (
                    <ExpandMoreIcon sx={{ fontSize: 16 }} />
                  ) : (
                    <ChevronRightIcon sx={{ fontSize: 16 }} />
                  )}
                </IconButton>
              ) : null}
            </Box>
            <Box
              component={Link}
              href={`/projects/${projectId}/cases?suite=${node.id}${filterQuery}`}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                flex: 1,
                minWidth: 0,
                py: 0.35,
                pl: depth * 1.5,
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <CreateNewFolderOutlinedIcon
                sx={{ fontSize: 16, color: "text.secondary", flexShrink: 0 }}
              />
              <Typography
                variant="body2"
                noWrap
                sx={{ flex: 1, fontWeight: selected ? 600 : 400 }}
              >
                {node.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {node.count}
              </Typography>
            </Box>
            <Box
              className="suite-actions"
              sx={{
                display: "flex",
                alignItems: "center",
                opacity: 0,
                transition: "opacity .1s",
                pr: 0.5,
              }}
            >
              <Box component="form" action={moveSuite} sx={{ display: "flex" }}>
                <input type="hidden" name="id" value={node.id} />
                <input type="hidden" name="direction" value="up" />
                <IconButton
                  size="small"
                  type="submit"
                  disabled={index === 0}
                  aria-label="Move suite up"
                >
                  <ArrowUpwardIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>
              <Box component="form" action={moveSuite} sx={{ display: "flex" }}>
                <input type="hidden" name="id" value={node.id} />
                <input type="hidden" name="direction" value="down" />
                <IconButton
                  size="small"
                  type="submit"
                  disabled={index === list.length - 1}
                  aria-label="Move suite down"
                >
                  <ArrowDownwardIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>
              <ConfirmButton
                action={deleteSuite}
                hidden={{ id: node.id }}
                title="Delete suite?"
                description="Cases in this suite are kept but become unassigned."
                confirmLabel="Delete suite"
                iconOnly
                ariaLabel="Delete suite"
                icon={<DeleteOutlinedIcon sx={{ fontSize: 16 }} />}
              />
            </Box>
          </Box>
          {hasChildren && isOpen ? renderNodes(node.children, depth + 1) : null}
        </Box>
      );
    });

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        height: "100%",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 1,
          py: 0.5,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Stack direction="row" spacing={0.25} sx={{ alignItems: "center" }}>
          <Typography variant="subtitle2">Suites</Typography>
          <FormDialog
            action={createSuite}
            hidden={{ projectId }}
            title="New suite"
            triggerIcon={<AddIcon fontSize="small" />}
            iconOnly
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
        </Stack>
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Tooltip title="Collapse all">
            <IconButton size="small" onClick={() => setExpanded(new Set())}>
              <UnfoldLessIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Expand all">
            <IconButton
              size="small"
              onClick={() => setExpanded(new Set(collectIds(nodes)))}
            >
              <UnfoldMoreIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      <Box sx={{ overflowY: "auto", flexGrow: 1, p: 1 }}>
        {nodes.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 1 }}>
            No suites yet.
          </Typography>
        ) : (
          renderNodes(nodes, 0)
        )}
      </Box>
    </Box>
  );
}
