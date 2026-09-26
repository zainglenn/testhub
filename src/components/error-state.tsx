"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useEffect } from "react";

export function ErrorState({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Box sx={{ minHeight: "50vh", display: "grid", placeItems: "center", p: 3 }}>
      <Stack
        spacing={2}
        sx={{ alignItems: "center", textAlign: "center", maxWidth: 440 }}
      >
        <Typography variant="h2">Something went wrong</Typography>
        <Typography color="text.secondary" variant="body2">
          {error.message || "An unexpected error occurred while loading this page."}
        </Typography>
        <Button variant="contained" onClick={() => reset()}>
          Try again
        </Button>
      </Stack>
    </Box>
  );
}
