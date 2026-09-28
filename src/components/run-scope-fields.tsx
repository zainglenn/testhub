"use client";

import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import { useState } from "react";

export function RunScopeFields({
  suiteOptions,
  tags,
  testSets,
}: {
  suiteOptions: { id: string; label: string }[];
  tags: { id: string; name: string }[];
  testSets: { id: string; name: string }[];
}) {
  const [scope, setScope] = useState("ALL");

  return (
    <>
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
        <MenuItem value="SET" disabled={testSets.length === 0}>
          By test set
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

      {scope === "SET" && testSets.length > 0 ? (
        <TextField
          select
          name="testSetId"
          label="Test set"
          defaultValue={testSets[0]?.id ?? ""}
        >
          {testSets.map((testSet) => (
            <MenuItem key={testSet.id} value={testSet.id}>
              {testSet.name}
            </MenuItem>
          ))}
        </TextField>
      ) : null}
    </>
  );
}
