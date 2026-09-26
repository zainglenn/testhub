"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import type { ReactNode } from "react";
import { useState } from "react";

export function CaseDetailTabs({
  header,
  generalView,
  generalEdit,
  properties,
  runs,
  jira,
}: {
  header: ReactNode;
  generalView: ReactNode;
  generalEdit: ReactNode;
  properties: ReactNode;
  runs: ReactNode;
  jira?: ReactNode;
}) {
  const [tab, setTab] = useState("general");
  const [editing, setEditing] = useState(false);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {header}
      <Tabs
        value={tab}
        onChange={(_event, value: string) => {
          setTab(value);
          setEditing(false);
        }}
        sx={{ px: 2, borderBottom: 1, borderColor: "divider", minHeight: 40 }}
      >
        <Tab value="general" label="General" sx={{ minHeight: 40 }} />
        <Tab value="properties" label="Properties" sx={{ minHeight: 40 }} />
        <Tab value="runs" label="Runs" sx={{ minHeight: 40 }} />
        {jira ? <Tab value="jira" label="Jira" sx={{ minHeight: 40 }} /> : null}
      </Tabs>

      <Box sx={{ p: 2, overflowY: "auto", flexGrow: 1 }}>
        {tab === "general" ? (
          <>
            <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1 }}>
              <Button size="small" onClick={() => setEditing((value) => !value)}>
                {editing ? "Done" : "Edit"}
              </Button>
            </Box>
            {editing ? generalEdit : generalView}
          </>
        ) : null}
        {tab === "properties" ? properties : null}
        {tab === "runs" ? runs : null}
        {jira && tab === "jira" ? jira : null}
      </Box>
    </Box>
  );
}
