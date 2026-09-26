"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState, useTransition } from "react";
import { createApiToken } from "@/lib/actions/tokens";

export function CreateTokenForm({ projectId }: { projectId: string }) {
  const [name, setName] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const create = () =>
    startTransition(async () => {
      const result = await createApiToken(projectId, name);
      if (result.ok && result.token) {
        setToken(result.token);
        setName("");
        setError(null);
        setCopied(false);
      } else {
        setError(result.error ?? "Could not create the token.");
      }
    });

  return (
    <Stack spacing={2}>
      {token ? (
        <Alert severity="success">
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Copy this token now — it will not be shown again.
          </Typography>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", mt: 1 }}>
            <TextField
              value={token}
              size="small"
              fullWidth
              slotProps={{
                htmlInput: {
                  readOnly: true,
                  style: { fontFamily: "var(--font-geist-mono), monospace" },
                },
              }}
            />
            <Button
              type="button"
              variant="outlined"
              onClick={() => {
                navigator.clipboard?.writeText(token);
                setCopied(true);
              }}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          </Box>
        </Alert>
      ) : null}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <TextField
          label="Token name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="GitHub Actions"
        />
        <Button
          type="button"
          variant="contained"
          onClick={create}
          disabled={pending || name.trim().length === 0}
          sx={{ flexShrink: 0 }}
        >
          {pending ? "Creating..." : "Create token"}
        </Button>
      </Stack>

      {error ? <Alert severity="error">{error}</Alert> : null}
    </Stack>
  );
}
