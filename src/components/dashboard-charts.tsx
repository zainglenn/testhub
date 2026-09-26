"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { BarChart } from "@mui/x-charts/BarChart";
import { LineChart } from "@mui/x-charts/LineChart";
import { PieChart } from "@mui/x-charts/PieChart";

export function ProjectCasesChart({
  data,
}: {
  data: { label: string; cases: number; suites: number }[];
}) {
  return (
    <BarChart
      height={300}
      xAxis={[{ scaleType: "band", data: data.map((item) => item.label) }]}
      series={[
        { label: "Test cases", data: data.map((item) => item.cases) },
        { label: "Suites", data: data.map((item) => item.suites) },
      ]}
      margin={{ top: 20, right: 16, bottom: 36, left: 36 }}
      grid={{ horizontal: true }}
    />
  );
}

export function ExecutionTrendChart({
  data,
}: {
  data: { label: string; executed: number; passed: number }[];
}) {
  return (
    <LineChart
      height={300}
      xAxis={[{ scaleType: "point", data: data.map((item) => item.label) }]}
      series={[
        {
          label: "Executed",
          data: data.map((item) => item.executed),
          curve: "monotoneX",
        },
        {
          label: "Passed",
          data: data.map((item) => item.passed),
          curve: "monotoneX",
        },
      ]}
      margin={{ top: 20, right: 16, bottom: 36, left: 36 }}
      grid={{ horizontal: true }}
    />
  );
}

export function CoveragePie({
  linked,
  unlinked,
}: {
  linked: number;
  unlinked: number;
}) {
  if (linked + unlinked === 0) {
    return (
      <Box
        sx={{
          height: 230,
          display: "grid",
          placeItems: "center",
          color: "text.secondary",
        }}
      >
        <Typography variant="body2">No test cases to measure yet.</Typography>
      </Box>
    );
  }

  return (
    <PieChart
      height={230}
      series={[
        {
          data: [
            { id: 0, value: linked, label: "Linked" },
            { id: 1, value: unlinked, label: "Unlinked" },
          ],
          innerRadius: 55,
          outerRadius: 90,
          paddingAngle: 2,
          cornerRadius: 4,
        },
      ]}
    />
  );
}

export function ResultsDonut({
  data,
}: {
  data: { label: string; value: number }[];
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <Box
        sx={{
          height: 230,
          display: "grid",
          placeItems: "center",
          color: "text.secondary",
        }}
      >
        <Typography variant="body2">No executions in this period.</Typography>
      </Box>
    );
  }

  return (
    <PieChart
      height={230}
      series={[
        {
          data: data.map((item, index) => ({
            id: index,
            value: item.value,
            label: item.label,
          })),
          innerRadius: 55,
          outerRadius: 90,
          paddingAngle: 2,
          cornerRadius: 4,
        },
      ]}
    />
  );
}
