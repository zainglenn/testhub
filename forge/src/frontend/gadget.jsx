import React, { useEffect, useState } from "react";
import ForgeReconciler, {
  Stack,
  Inline,
  Heading,
  Text,
  Lozenge,
  ProgressBar,
  SectionMessage,
  Spinner,
  Link,
  useConfig,
} from "@forge/react";
import { invoke } from "@forge/bridge";

function coverageAppearance(pct) {
  if (pct >= 80) return "success";
  if (pct >= 50) return "moved";
  return "removed";
}

const App = () => {
  const config = useConfig() || {};
  const projectKey = config.projectKey;

  const [data, setData] = useState(undefined);
  const [error, setError] = useState(undefined);

  useEffect(() => {
    invoke("getMetrics", projectKey ? { projectKey } : {})
      .then(setData)
      .catch((e) => setError(e && e.message ? e.message : String(e)));
  }, [projectKey]);

  if (error) {
    return (
      <SectionMessage appearance="error">
        <Text>{String(error)}</Text>
      </SectionMessage>
    );
  }
  if (!data) {
    return <Spinner />;
  }
  if (data.error) {
    return (
      <SectionMessage appearance="warning">
        <Text>{data.error}</Text>
      </SectionMessage>
    );
  }

  const totals = data.totals;

  return (
    <Stack space="space.150">
      <Inline space="space.100" alignBlock="center" shouldWrap>
        <Heading as="h4">{data.project.name}</Heading>
        <Lozenge appearance={coverageAppearance(data.coverage)}>
          {`${data.coverage}% passing`}
        </Lozenge>
      </Inline>

      <ProgressBar value={data.coverage / 100} />

      <Text>
        {`${totals.cases} case(s) · ${totals.passed} passed · ${totals.failed} failed · ${totals.untested} untested`}
      </Text>

      {data.trend && data.trend.length > 0 ? (
        <Text>
          {`Last 14 days: ${data.trend.reduce((sum, point) => sum + point.executed, 0)} executions, ${data.trend.reduce((sum, point) => sum + point.passed, 0)} passed`}
        </Text>
      ) : null}

      {data.reportsUrl ? (
        <Inline>
          <Link href={data.reportsUrl} target="_blank">
            Open reports in TestHub
          </Link>
        </Inline>
      ) : null}

      {!projectKey ? (
        <Text>
          Showing the default mapped project — configure the gadget to pick
          another.
        </Text>
      ) : null}
    </Stack>
  );
};

ForgeReconciler.render(<App />);
