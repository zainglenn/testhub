"use client";

import SearchIcon from "@mui/icons-material/Search";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import { useState } from "react";
import { CASE_STATUSES, PRIORITIES } from "@/lib/constants";

export function CaseFilters({
  q,
  field,
  priority,
  status,
  tag,
  tags,
  activeSuiteId,
  resetHref,
}: {
  q: string;
  field: string;
  priority: string;
  status: string;
  tag: string;
  tags: { id: string; name: string }[];
  activeSuiteId: string | null;
  resetHref: string;
}) {
  const [showFilters, setShowFilters] = useState(
    Boolean(priority || status || tag),
  );

  return (
    <Box
      component="form"
      method="get"
      sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}
    >
      {activeSuiteId ? (
        <input type="hidden" name="suite" value={activeSuiteId} />
      ) : null}

      <TextField
        name="q"
        placeholder="Search"
        defaultValue={q}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
        sx={{ flex: "1 1 280px", maxWidth: 520 }}
      />

      <Select name="field" defaultValue={field} sx={{ minWidth: 160 }}>
        <MenuItem value="ALL">By all fields</MenuItem>
        <MenuItem value="TITLE">By title</MenuItem>
        <MenuItem value="KEY">By key</MenuItem>
      </Select>

      {showFilters ? (
        <>
          <Select name="priority" defaultValue={priority} sx={{ minWidth: 130 }}>
            <MenuItem value="">Priority: all</MenuItem>
            {PRIORITIES.map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </Select>
          <Select name="status" defaultValue={status} sx={{ minWidth: 130 }}>
            <MenuItem value="">Status: all</MenuItem>
            {CASE_STATUSES.map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </Select>
          {tags.length > 0 ? (
            <Select name="tag" defaultValue={tag} sx={{ minWidth: 130 }}>
              <MenuItem value="">Tag: all</MenuItem>
              {tags.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.name}
                </MenuItem>
              ))}
            </Select>
          ) : null}
          <Button type="submit" variant="outlined">
            Apply
          </Button>
          <Button href={resetHref}>Reset</Button>
        </>
      ) : (
        <>
          {priority ? (
            <input type="hidden" name="priority" value={priority} />
          ) : null}
          {status ? <input type="hidden" name="status" value={status} /> : null}
          {tag ? <input type="hidden" name="tag" value={tag} /> : null}
          <Button type="button" onClick={() => setShowFilters(true)}>
            + Add filter
          </Button>
        </>
      )}
    </Box>
  );
}
