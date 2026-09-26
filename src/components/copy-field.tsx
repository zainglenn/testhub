"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import { useState } from "react";

export function CopyField({
  value,
  label,
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
      <TextField
        value={value}
        size="small"
        fullWidth
        label={label}
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
          navigator.clipboard?.writeText(value);
          setCopied(true);
        }}
      >
        {copied ? "Copied" : "Copy"}
      </Button>
    </Box>
  );
}
