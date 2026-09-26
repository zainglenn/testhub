"use client";

import SearchIcon from "@mui/icons-material/Search";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import InputAdornment from "@mui/material/InputAdornment";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useActionState, useEffect, useRef, useState } from "react";
import { initialActionState } from "@/lib/action-state";
import { linkIssue } from "@/lib/actions/jira";

type IssueOption = {
  key: string;
  summary: string;
  type: string;
  status: string;
};

export function JiraIssuePicker({
  testCaseId,
  onLinked,
}: {
  testCaseId: string;
  onLinked?: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    linkIssue,
    initialActionState,
  );
  const [query, setQuery] = useState("");
  const [issueKey, setIssueKey] = useState("");
  const [results, setResults] = useState<IssueOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const lastOk = useRef(false);

  useEffect(() => {
    if (state.ok && !lastOk.current) {
      lastOk.current = true;
      setQuery("");
      setIssueKey("");
      setResults([]);
      onLinked?.();
    }
    if (!state.ok) {
      lastOk.current = false;
    }
  }, [state, onLinked]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const response = await fetch(
          `/api/jira/issues?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? "Search failed");
        }
        setResults(data.issues ?? []);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setSearchError((error as Error).message);
        }
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return (
    <Box component="form" action={formAction} sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <input type="hidden" name="testCaseId" value={testCaseId} />
      <input type="hidden" name="issueKey" value={issueKey} />

      <Box sx={{ display: "flex", gap: 1 }}>
        <TextField
          value={query}
          onChange={(event) => {
            const value = event.target.value;
            setQuery(value);
            setIssueKey("");
            if (value.trim().length < 2) {
              setResults([]);
              setSearchError(null);
            }
          }}
          placeholder="Search Jira or paste a key"
          autoComplete="off"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: searching ? (
                <InputAdornment position="end">
                  <CircularProgress size={16} />
                </InputAdornment>
              ) : undefined,
            },
          }}
        />
        <Button
          type="submit"
          variant="contained"
          disabled={!issueKey || pending}
          sx={{ flexShrink: 0 }}
        >
          Link
        </Button>
      </Box>

      {issueKey ? (
        <Typography variant="caption" color="text.secondary">
          Selected <strong>{issueKey}</strong>
          {" · "}
          <Button
            size="small"
            onClick={() => {
              setIssueKey("");
              setQuery("");
            }}
            sx={{ minWidth: 0, p: 0.5 }}
          >
            clear
          </Button>
        </Typography>
      ) : null}

      {searchError ? <Alert severity="error">{searchError}</Alert> : null}
      {state.error ? <Alert severity="error">{state.error}</Alert> : null}

      {results.length > 0 ? (
        <Paper variant="outlined" sx={{ maxHeight: 240, overflow: "auto" }}>
          <List dense disablePadding>
            {results.map((issue) => (
              <ListItemButton
                key={issue.key}
                onClick={() => {
                  setIssueKey(issue.key);
                  setQuery(`${issue.key} ${issue.summary}`.trim());
                  setResults([]);
                }}
              >
                <ListItemText
                  primary={
                    <Box
                      component="span"
                      sx={{ display: "flex", gap: 1, alignItems: "baseline" }}
                    >
                      <Typography
                        component="span"
                        variant="body2"
                        sx={{ fontWeight: 600 }}
                      >
                        {issue.key}
                      </Typography>
                      <Typography
                        component="span"
                        variant="caption"
                        color="text.secondary"
                      >
                        {issue.type}
                        {issue.status ? ` · ${issue.status}` : ""}
                      </Typography>
                    </Box>
                  }
                  secondary={issue.summary}
                />
              </ListItemButton>
            ))}
          </List>
        </Paper>
      ) : query.trim().length >= 2 && !searching && !searchError ? (
        <Typography variant="caption" color="text.secondary">
          No matching issues.
        </Typography>
      ) : null}
    </Box>
  );
}
