"use client";

import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import { useState } from "react";
import { JiraIssuePicker } from "./jira-issue-picker";

export function JiraLinkDialog({ testCaseId }: { testCaseId: string }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <Button variant="outlined" size="small" onClick={() => setOpen(true)}>
        Link issue
      </Button>
      <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
        <DialogTitle>Link a Jira issue</DialogTitle>
        <DialogContent>
          <JiraIssuePicker testCaseId={testCaseId} onLinked={close} />
        </DialogContent>
      </Dialog>
    </>
  );
}
