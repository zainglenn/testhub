"use client";

import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import { useTransition } from "react";
import { setMemberRole } from "@/lib/actions/users";

export function MemberRoleSelect({
  userId,
  roleId,
  roles,
}: {
  userId: string;
  roleId: string | null;
  roles: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Select
      size="small"
      displayEmpty
      value={roleId ?? ""}
      disabled={pending}
      onChange={(event) => {
        const value = event.target.value;
        startTransition(async () => {
          await setMemberRole(userId, value || null);
        });
      }}
      sx={{ minWidth: 160 }}
    >
      <MenuItem value="">No role</MenuItem>
      {roles.map((role) => (
        <MenuItem key={role.id} value={role.id}>
          {role.name}
        </MenuItem>
      ))}
    </Select>
  );
}
