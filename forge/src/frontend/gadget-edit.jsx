import React, { useEffect, useState } from "react";
import ForgeReconciler, {
  Stack,
  Text,
  Textfield,
  Button,
  SectionMessage,
} from "@forge/react";
import { invoke, view } from "@forge/bridge";

const App = () => {
  const [projectKey, setProjectKey] = useState("");
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState(undefined);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    invoke("getProjectOptions")
      .then((result) => {
        if (result && result.error) setError(result.error);
        else setProjects((result && result.projects) || []);
      })
      .catch((e) => setError(e && e.message ? e.message : String(e)));
  }, []);

  const save = () => {
    setSaving(true);
    view
      .submit({ projectKey: projectKey.trim().toUpperCase(), refresh: 15 })
      .catch((e) => {
        setError(e && e.message ? e.message : String(e));
        setSaving(false);
      });
  };

  return (
    <Stack space="space.100">
      <Text>Choose a TestHub project by its Jira project key.</Text>
      <Textfield
        value={projectKey}
        onChange={(e) => setProjectKey(e.target.value)}
        placeholder="e.g. SCRUM"
      />
      {projects.length > 0 ? (
        <Text>{`Mapped: ${projects.map((p) => p.jiraProjectKey).join(", ")}`}</Text>
      ) : null}
      {error ? (
        <SectionMessage appearance="error">
          <Text>{error}</Text>
        </SectionMessage>
      ) : null}
      <Button appearance="primary" isDisabled={saving || !projectKey} onClick={save}>
        Save
      </Button>
    </Stack>
  );
};

ForgeReconciler.render(<App />);
