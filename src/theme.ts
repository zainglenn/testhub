"use client";

import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  cssVariables: true,
  colorSchemes: {
    light: true,
  },
  shape: {
    borderRadius: 10,
  },
  typography: {
    fontFamily:
      "var(--font-geist-sans), system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    h1: { fontSize: "2rem", fontWeight: 600, letterSpacing: "-0.02em" },
    h2: { fontSize: "1.5rem", fontWeight: 600, letterSpacing: "-0.01em" },
    h3: { fontSize: "1.125rem", fontWeight: 600 },
    subtitle1: { fontWeight: 600 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 8 } },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { backgroundImage: "none" } },
    },
    MuiCard: {
      defaultProps: { elevation: 0, variant: "outlined" },
    },
    MuiTextField: {
      defaultProps: { size: "small", fullWidth: true },
    },
    MuiSelect: {
      defaultProps: { size: "small" },
    },
  },
});

export default theme;
