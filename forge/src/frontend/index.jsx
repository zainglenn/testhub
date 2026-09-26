import React, { useEffect, useState } from "react";
import ForgeReconciler, { Text, Heading, useProductContext } from "@forge/react";
import { invoke } from "@forge/bridge";

const App = () => {
  const context = useProductContext();
  const issueKey = context && context.platformContext
    ? context.platformContext.issueKey
    : undefined;
  const [data, setData] = useState(undefined);
  const [error, setError] = useState(undefined);

  useEffect(() => {
    invoke("getCoverage", { key: issueKey })
      .then(setData)
      .catch((e) => setError(e && e.message ? e.message : String(e)));
  }, []);

  if (error) {
    return <Text>{String(error)}</Text>;
  }
  if (!data) {
    return <Text>Loading TestHub coverage…</Text>;
  }
  if (data.error) {
    return <Text>{data.error}</Text>;
  }

  return (
    <>
      <Heading as="h3">TestHub coverage</Heading>
      {data.summary.total === 0 ? (
        <Text>No tests are linked to this issue yet.</Text>
      ) : (
        <Text>
          {`${data.summary.coverage}% passing · ${data.summary.total} test(s) · `}
          {`${data.summary.passed} passed · ${data.summary.failed} failed`}
        </Text>
      )}
      {(data.tests || []).map((test) => (
        <Text key={test.id}>{`${test.status} — ${test.key} — ${test.title}`}</Text>
      ))}
      {(data.linkedBugs || []).length > 0 ? (
        <Text>
          {`Linked bugs: ${data.linkedBugs.map((bug) => bug.issueKey).join(", ")}`}
        </Text>
      ) : null}
    </>
  );
};

ForgeReconciler.render(<App />);
