"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import type { ReactNode } from "react";
import { useEffect, useRef, useActionState } from "react";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { useToast } from "./toast";

export type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function ActionForm({
  action,
  children,
  hidden,
  submitLabel,
  pendingLabel = "Saving...",
  variant = "contained",
  secondary,
  onSuccess,
  successMessage,
}: {
  action: Action;
  children?: ReactNode;
  hidden?: Record<string, string>;
  submitLabel: string;
  pendingLabel?: string;
  variant?: "contained" | "outlined";
  secondary?: ReactNode;
  onSuccess?: () => void;
  successMessage?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const wasOk = useRef(false);
  const toast = useToast();

  useEffect(() => {
    if (state.ok && !wasOk.current) {
      wasOk.current = true;
      if (successMessage) {
        toast({ message: successMessage, severity: "success" });
      }
      onSuccess?.();
    }
    if (!state.ok) {
      wasOk.current = false;
    }
  }, [state, onSuccess, successMessage, toast]);

  return (
    <Box
      component="form"
      action={formAction}
      sx={{ display: "flex", flexDirection: "column", gap: 2 }}
    >
      {hidden
        ? Object.entries(hidden).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))
        : null}
      {children}
      {state.error ? <Alert severity="error">{state.error}</Alert> : null}
      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
        <Button type="submit" variant={variant} disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
        {secondary}
      </Box>
    </Box>
  );
}
