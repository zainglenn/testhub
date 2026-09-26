"use client";

import Dialog from "@mui/material/Dialog";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CaseDetailTabs } from "./case-detail-tabs";

export function CaseModal({
  open,
  closeHref,
  header,
  generalView,
  generalEdit,
  properties,
  runs,
  jira,
}: {
  open: boolean;
  closeHref: string;
  header: ReactNode;
  generalView: ReactNode;
  generalEdit: ReactNode;
  properties: ReactNode;
  runs: ReactNode;
  jira?: ReactNode;
}) {
  const router = useRouter();

  return (
    <Dialog
      open={open}
      onClose={() => router.push(closeHref)}
      fullWidth
      maxWidth="lg"
      slotProps={{ paper: { sx: { height: "90vh" } } }}
    >
      <CaseDetailTabs
        header={header}
        generalView={generalView}
        generalEdit={generalEdit}
        properties={properties}
        runs={runs}
        jira={jira}
      />
    </Dialog>
  );
}
