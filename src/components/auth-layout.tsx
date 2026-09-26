import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
      }}
    >
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          flex: 1,
          position: "relative",
          flexDirection: "column",
          justifyContent: "space-between",
          p: 6,
          color: "#fff",
          backgroundColor: "#1e3a8a",
          backgroundImage: "url(/auth-illustration.svg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Avatar
            variant="rounded"
            sx={{ bgcolor: "rgba(255,255,255,0.16)", fontWeight: 700 }}
          >
            T
          </Avatar>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            TestHub
          </Typography>
        </Stack>

        <Box>
          <Typography variant="h3" sx={{ fontWeight: 700, maxWidth: 440 }}>
            Test management that stays in sync with Jira.
          </Typography>
          <Typography
            sx={{ mt: 2, maxWidth: 440, color: "rgba(255,255,255,0.82)" }}
          >
            Organise suites, run tests, and trace coverage to Jira issues from a
            single workspace.
          </Typography>
        </Box>

        <Typography
          variant="caption"
          sx={{ color: "rgba(255,255,255,0.65)" }}
        >
          © {new Date().getFullYear()} TestHub
        </Typography>
      </Box>

      <Box
        sx={{
          width: { xs: "100%", md: 480 },
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: { xs: 3, sm: 6 },
          bgcolor: "background.paper",
        }}
      >
        <Box sx={{ width: "100%", maxWidth: 380 }}>
          <Stack
            direction="row"
            spacing={1.25}
            sx={{
              alignItems: "center",
              mb: 3,
              display: { xs: "flex", md: "none" },
            }}
          >
            <Avatar
              variant="rounded"
              sx={{ bgcolor: "primary.main", fontWeight: 700 }}
            >
              T
            </Avatar>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              TestHub
            </Typography>
          </Stack>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
