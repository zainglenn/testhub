"use client";

import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import { useTransition } from "react";
import { assignRun, setRunPlan } from "@/lib/actions/plans";

export function RunControls({
  runId,
  assigneeId,
  planId,
  members,
  plans,
}: {
  runId: string;
  assigneeId: string | null;
  planId: string | null;
  members: { id: string; name: string }[];
  plans: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();

  const submit = (
    action: (formData: FormData) => Promise<void>,
    field: string,
    value: string,
  ) =>
    startTransition(async () => {
      const formData = new FormData();
      formData.set("runId", runId);
      formData.set(field, value);
      await action(formData);
    });

  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <Select
        size="small"
        displayEmpty
        value={assigneeId ?? ""}
        disabled={pending}
        onChange={(event) => submit(assignRun, "assigneeId", event.target.value)}
        sx={{ minWidth: 150 }}
      >
        <MenuItem value="">Unassigned</MenuItem>
        {members.map((member) => (
          <MenuItem key={member.id} value={member.id}>
            {member.name}
          </MenuItem>
        ))}
      </Select>
      <Select
        size="small"
        displayEmpty
        value={planId ?? ""}
        disabled={pending}
        onChange={(event) => submit(setRunPlan, "planId", event.target.value)}
        sx={{ minWidth: 170 }}
      >
        <MenuItem value="">No plan</MenuItem>
        {plans.map((plan) => (
          <MenuItem key={plan.id} value={plan.id}>
            {plan.name}
          </MenuItem>
        ))}
      </Select>
    </Stack>
  );
}
