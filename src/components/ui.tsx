import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";
import { PRIORITY_COLORS, STATUS_COLORS } from "@/lib/constants";

export function PriorityChip({ priority }: { priority: string }) {
  return (
    <Chip
      size="small"
      label={priority}
      color={PRIORITY_COLORS[priority] ?? "default"}
      variant={priority === "LOW" ? "outlined" : "filled"}
    />
  );
}

export function StatusChip({ status }: { status: string }) {
  return (
    <Chip
      size="small"
      label={status}
      color={STATUS_COLORS[status] ?? "default"}
      variant={status === "DRAFT" ? "outlined" : "filled"}
    />
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <Card>
      <CardContent>
        <Typography
          variant="overline"
          color="text.secondary"
          sx={{ letterSpacing: 1 }}
        >
          {label}
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          {value}
          {hint ? (
            <Typography
              component="span"
              variant="h6"
              color="text.secondary"
              sx={{ ml: 0.5, fontWeight: 400 }}
            >
              {hint}
            </Typography>
          ) : null}
        </Typography>
      </CardContent>
    </Card>
  );
}
