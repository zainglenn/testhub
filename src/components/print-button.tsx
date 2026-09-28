"use client";

import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import Button from "@mui/material/Button";

export function PrintButton({ label = "Print / Save as PDF" }: { label?: string }) {
  return (
    <Button
      variant="contained"
      startIcon={<PrintOutlinedIcon />}
      onClick={() => window.print()}
      sx={{ "@media print": { display: "none" } }}
    >
      {label}
    </Button>
  );
}
