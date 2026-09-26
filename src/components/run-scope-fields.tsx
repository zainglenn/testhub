"use client";

import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import { useState } from "react";

const ENVIRONMENTS = ["Local", "Development", "Staging", "Production", "CI"];

export function RunScopeFields({
  suiteOptions,
  tags,
}: {
  suiteOptions: { id: string; label: string }[];
  tags: { id: string; name: string }[];
}) {
  const [scope, setScope] = useState("ALL");

  return (
    <>
      <TextField select name="environment" label="Environment" defaultValue="">
        <MenuItem value="">None</MenuItem>
        {ENVIRONMENTS.map((environment) => (
          <MenuItem key={environment} value={environment}>
            {environment}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        select
        name="scope"
        label="Scope"
        value={scope}
        onChange={(event) => setScope(event.target.value)}
      >
        <MenuItem value="ALL">All test cases</MenuItem>
        <MenuItem value="SUITE" disabled={suiteOptions.length === 0}>
          By suite
        </MenuItem>
        <MenuItem value="TAG" disabled={tags.length === 0}>
          By tag
        </MenuItem>
      </TextField>

      {scope === "SUITE" && suiteOptions.length > 0 ? (
        <TextField
          select
          name="suiteId"
          label="Suite"
          defaultValue={suiteOptions[0]?.id ?? ""}
        >
          {suiteOptions.map((option) => (
            <MenuItem key={option.id} value={option.id}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
      ) : null}

      {scope === "TAG" && tags.length > 0 ? (
        <TextField
          select
          name="tagId"
          label="Tag"
          defaultValue={tags[0]?.id ?? ""}
        >
          {tags.map((tag) => (
            <MenuItem key={tag.id} value={tag.id}>
              {tag.name}
            </MenuItem>
          ))}
        </TextField>
      ) : null}
    </>
  );
}
