"use client";

import Drawer from "@mui/material/Drawer";
import type { ReactNode } from "react";
import { CaseDetailTabs } from "./case-detail-tabs";

export function CasePanel({
  open,
  header,
  generalView,
  generalEdit,
  properties,
  runs,
  jira,
}: {
  open: boolean;
  header: ReactNode;
  generalView: ReactNode;
  generalEdit: ReactNode;
  properties: ReactNode;
  runs: ReactNode;
  jira?: ReactNode;
}) {
  return (
    <Drawer
      anchor="right"
      variant="persistent"
      open={open}
      sx={{
        "& .MuiDrawer-paper": {
          width: { xs: "100%", md: 640 },
          boxSizing: "border-box",
          borderLeft: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
        },
      }}
    >
      <CaseDetailTabs
        header={header}
        generalView={generalView}
        generalEdit={generalEdit}
        properties={properties}
        runs={runs}
        jira={jira}
      />
    </Drawer>
  );
}
