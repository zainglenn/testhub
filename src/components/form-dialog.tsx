"use client";

import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";
import { useState } from "react";
import { ActionForm, type Action } from "./action-form";

export function FormDialog({
  action,
  title,
  description,
  triggerLabel,
  submitLabel,
  triggerVariant = "contained",
  triggerIcon,
  iconOnly = false,
  hidden,
  successMessage,
  children,
}: {
  action: Action;
  title: string;
  description?: string;
  triggerLabel?: string;
  submitLabel: string;
  triggerVariant?: "contained" | "outlined";
  triggerIcon?: ReactNode;
  iconOnly?: boolean;
  hidden?: Record<string, string>;
  successMessage?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      {iconOnly ? (
        <Tooltip title={title}>
          <IconButton size="small" aria-label={title} onClick={() => setOpen(true)}>
            {triggerIcon}
          </IconButton>
        </Tooltip>
      ) : (
        <Button
          variant={triggerVariant}
          startIcon={triggerIcon}
          onClick={() => setOpen(true)}
        >
          {triggerLabel}
        </Button>
      )}
      <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          {description ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {description}
            </Typography>
          ) : null}
          <ActionForm
            action={action}
            hidden={hidden}
            submitLabel={submitLabel}
            successMessage={successMessage}
            onSuccess={close}
            secondary={
              <Button type="button" color="inherit" onClick={close}>
                Cancel
              </Button>
            }
          >
            {children}
          </ActionForm>
        </DialogContent>
      </Dialog>
    </>
  );
}
