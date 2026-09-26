"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import type { ReactNode } from "react";
import { useState } from "react";

type VoidAction = (formData: FormData) => Promise<void>;

export function ConfirmButton({
  action,
  hidden,
  title,
  description,
  confirmLabel = "Delete",
  label,
  ariaLabel,
  icon,
  iconOnly = false,
  size = "small",
  color = "error",
  variant = "outlined",
}: {
  action: VoidAction;
  hidden?: Record<string, string>;
  title: string;
  description: string;
  confirmLabel?: string;
  label?: string;
  ariaLabel?: string;
  icon?: ReactNode;
  iconOnly?: boolean;
  size?: "small" | "medium" | "large";
  color?: "error" | "inherit" | "primary";
  variant?: "text" | "outlined" | "contained";
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      {iconOnly ? (
        <IconButton
          size={size}
          color={color === "error" ? "error" : "default"}
          aria-label={ariaLabel}
          onClick={() => setOpen(true)}
        >
          {icon}
        </IconButton>
      ) : (
        <Button
          size={size}
          color={color}
          variant={variant}
          startIcon={icon}
          onClick={() => setOpen(true)}
        >
          {label}
        </Button>
      )}

      <Dialog open={open} onClose={close} maxWidth="xs" fullWidth>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <DialogContentText>{description}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={close}>
            Cancel
          </Button>
          <Box component="form" action={action}>
            {hidden
              ? Object.entries(hidden).map(([name, value]) => (
                  <input key={name} type="hidden" name={name} value={value} />
                ))
              : null}
            <Button type="submit" color="error" variant="contained">
              {confirmLabel}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
    </>
  );
}
