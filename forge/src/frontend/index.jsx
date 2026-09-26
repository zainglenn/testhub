import React, { useEffect, useState } from "react";
import ForgeReconciler, {
  Stack,
  Inline,
  Heading,
  Text,
  Lozenge,
  Link,
  LinkButton,
  ProgressBar,
  DynamicTable,
  SectionMessage,
  Spinner,
  useProductContext,
} from "@forge/react";
import { invoke } from "@forge/bridge";

const TEST_APPEARANCE = {
  PASS: "success",
  FAIL: "removed",
  BLOCKED: "moved",
  SKIPPED: "default",
  UNTESTED: "new",
};

function coverageAppearance(pct) {
  if (pct >= 80) return "success";
  if (pct >= 50) return "moved";
  return "removed";
}

const App = () => {
  const context = useProductContext();
  const issueKey =
    context && context.platformContext ? context.platformContext.issueKey : undefined;
  const [data, setData] = useState(undefined);
  const [error, setError] = useState(undefined);

  useEffect(() => {
    invoke("getCoverage", { key: issueKey })
      .then(setData)
      .catch((e) => setError(e && e.message ? e.message : String(e)));
  }, []);

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

  const summary = data.summary;
  const tests = data.tests || [];
  const linkedBugs = data.linkedBugs || [];
  const projectUrl =
    tests.length > 0 && tests[0].url ? tests[0].url.split("/cases")[0] : undefined;

  return (
    <Stack space="space.150">
      <Inline space="space.100" alignBlock="center" shouldWrap>
        <Heading as="h4">TestHub coverage</Heading>
        <Lozenge appearance={coverageAppearance(summary.coverage)}>
          {`${summary.coverage}% passing`}
        </Lozenge>
      </Inline>

      <ProgressBar value={summary.coverage / 100} />

      <Text>
        {`${summary.total} test(s) · ${summary.passed} passed · ${summary.failed} failed`}
      </Text>

      {tests.length === 0 ? (
        <SectionMessage appearance="information">
          <Text>No tests are linked to this issue yet.</Text>
        </SectionMessage>
      ) : (
        <DynamicTable
          head={{
            cells: [
              { key: "test", content: "Test" },
              { key: "status", content: "Result" },
              { key: "when", content: "Last run" },
            ],
          }}
          rows={tests.map((test) => ({
            key: test.id,
            cells: [
              {
                key: "test",
                content: test.url ? (
                  <Link href={test.url} target="_blank">
                    {`${test.key} ${test.title}`}
                  </Link>
                ) : (
                  <Text>{`${test.key} ${test.title}`}</Text>
                ),
              },
              {
                key: "status",
                content: (
                  <Lozenge appearance={TEST_APPEARANCE[test.status] || "default"}>
                    {test.status}
                  </Lozenge>
                ),
              },
              {
                key: "when",
                content: test.lastExecutedAt
                  ? new Date(test.lastExecutedAt).toLocaleString()
                  : "—",
              },
            ],
          }))}
        />
      )}

      {linkedBugs.length > 0 ? (
        <Inline space="space.050" alignBlock="center" shouldWrap>
          <Text>Linked bugs:</Text>
          {linkedBugs.map((bug) =>
            bug.url ? (
              <Link key={bug.issueKey} href={bug.url} target="_blank">
                {bug.issueKey}
              </Link>
            ) : (
              <Text key={bug.issueKey}>{bug.issueKey}</Text>
            ),
          )}
        </Inline>
      ) : null}

      {projectUrl ? (
        <Inline>
          <LinkButton href={projectUrl} target="_blank" appearance="primary">
            Open in TestHub
          </LinkButton>
        </Inline>
      ) : null}
    </Stack>
  );
};

ForgeReconciler.render(<App />);
