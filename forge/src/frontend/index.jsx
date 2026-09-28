import React, { useEffect, useState } from "react";
import ForgeReconciler, {
  Stack,
  Inline,
  Box,
  Heading,
  Text,
  Lozenge,
  Link,
  LinkButton,
  Button,
  ProgressBar,
  DynamicTable,
  SectionMessage,
  Spinner,
  Modal,
  ModalTransition,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter,
  Textfield,
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
  const [notice, setNotice] = useState(undefined);
  const [busy, setBusy] = useState(false);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const refresh = () => {
    invoke("getCoverage", { key: issueKey, issueKey })
      .then(setData)
      .catch((e) => setError(e && e.message ? e.message : String(e)));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = (promise, onOk) => {
    setBusy(true);
    setNotice(undefined);
    promise
      .then((result) => {
        if (result && result.error) {
          setNotice({ appearance: "error", text: result.error });
        } else if (onOk) {
          onOk(result);
        }
      })
      .catch((e) => setNotice({ appearance: "error", text: e && e.message ? e.message : String(e) }))
      .finally(() => setBusy(false));
  };

  const search = () =>
    run(invoke("searchTests", { issueKey, query }), (result) => {
      setResults(result.tests || []);
      if ((result.tests || []).length === 0) {
        setNotice({ appearance: "information", text: "No tests matched." });
      }
    });

  const link = (caseKey) =>
    run(invoke("linkTest", { issueKey, caseKey }), () => {
      setOpen(false);
      setNotice({ appearance: "success", text: `Linked ${caseKey}.` });
      refresh();
    });

  const createTest = () =>
    run(
      invoke("createTest", {
        issueKey,
        title: newTitle,
        description: newDescription,
      }),
      (result) => {
        setOpen(false);
        setNewTitle("");
        setNewDescription("");
        setNotice({
          appearance: "success",
          text: `Created ${result.test ? result.test.key : "test"}.`,
        });
        refresh();
      },
    );

  const record = (caseKey, status) =>
    run(invoke("recordResult", { issueKey, caseKey, status }), () => {
      setNotice({ appearance: "success", text: `Recorded ${status} for ${caseKey}.` });
      refresh();
    });

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
        <Button appearance="subtle" spacing="compact" onClick={() => setOpen(true)}>
          Add tests
        </Button>
      </Inline>

      <ProgressBar value={summary.coverage / 100} />

      <Text>
        {`${summary.total} test(s) · ${summary.passed} passed · ${summary.failed} failed`}
      </Text>

      {notice ? (
        <SectionMessage appearance={notice.appearance}>
          <Text>{notice.text}</Text>
        </SectionMessage>
      ) : null}

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
              { key: "actions", content: "Record" },
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
              {
                key: "actions",
                content: (
                  <Inline space="space.050">
                    <Button
                      appearance="primary"
                      spacing="compact"
                      isDisabled={busy}
                      onClick={() => record(test.key, "PASS")}
                    >
                      Pass
                    </Button>
                    <Button
                      appearance="danger"
                      spacing="compact"
                      isDisabled={busy}
                      onClick={() => record(test.key, "FAIL")}
                    >
                      Fail
                    </Button>
                  </Inline>
                ),
              },
            ],
          }))}
        />
      )}

      {tests.some((test) => (test.steps || []).length > 0) ? (
        <Stack space="space.100">
          <Text>Steps</Text>
          {tests
            .filter((test) => (test.steps || []).length > 0)
            .map((test) => (
              <Stack key={test.id} space="space.025">
                <Text>{`${test.key} ${test.title}`}</Text>
                {test.steps.map((step) => (
                  <Text key={step.order}>
                    {`${step.order}. ${step.action}${step.expectedResult ? ` => ${step.expectedResult}` : ""}`}
                  </Text>
                ))}
              </Stack>
            ))}
        </Stack>
      ) : null}

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

      <ModalTransition>
        {open ? (
          <Modal onClose={() => setOpen(false)}>
            <ModalHeader>
              <ModalTitle>Add tests to this issue</ModalTitle>
            </ModalHeader>
            <ModalBody>
              <Stack space="space.150">
                <Text>Link an existing test</Text>
                <Inline space="space.100" alignBlock="center">
                  <Box>
                    <Textfield
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search tests by title"
                    />
                  </Box>
                  <Button appearance="primary" isDisabled={busy} onClick={search}>
                    Search
                  </Button>
                </Inline>

                {results.length > 0 ? (
                  <DynamicTable
                    head={{
                      cells: [
                        { key: "test", content: "Test" },
                        { key: "status", content: "Result" },
                        { key: "action", content: "" },
                      ],
                    }}
                    rows={results.map((test) => ({
                      key: test.id,
                      cells: [
                        { key: "test", content: `${test.key} ${test.title}` },
                        {
                          key: "status",
                          content: (
                            <Lozenge appearance={TEST_APPEARANCE[test.status] || "default"}>
                              {test.status}
                            </Lozenge>
                          ),
                        },
                        {
                          key: "action",
                          content: (
                            <Button
                              appearance="primary"
                              spacing="compact"
                              isDisabled={busy}
                              onClick={() => link(test.key)}
                            >
                              Link
                            </Button>
                          ),
                        },
                      ],
                    }))}
                  />
                ) : null}

                <Text>Or create a new test</Text>
                <Textfield
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Test title"
                />
                <Textfield
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Description (optional)"
                />
              </Stack>
            </ModalBody>
            <ModalFooter>
              <Button appearance="subtle" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                appearance="primary"
                isDisabled={busy || !newTitle}
                onClick={createTest}
              >
                Create &amp; link
              </Button>
            </ModalFooter>
          </Modal>
        ) : null}
      </ModalTransition>
    </Stack>
  );
};

ForgeReconciler.render(<App />);
