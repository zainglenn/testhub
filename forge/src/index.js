import Resolver from "@forge/resolver";

const resolver = new Resolver();

const BASE_URL = process.env.TESTHUB_BASE_URL ?? "https://testhub-one.vercel.app";

function issueKeyFrom(req) {
  const context = req.context ?? {};
  return (
    req.payload?.issueKey ??
    context.extension?.issue?.key ??
    context.platformContext?.issueKey ??
    req.payload?.key
  );
}

async function api(path, { method = "GET", body } = {}) {
  const secret = process.env.TESTHUB_PANEL_SECRET;
  if (!secret) {
    return { error: "TESTHUB_PANEL_SECRET is not configured for this app." };
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secret}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = {};
  }

  if (!response.ok) {
    return {
      error: json.error ?? `TestHub API responded ${response.status}: ${text.slice(0, 200)}`,
    };
  }
  return json;
}

resolver.define("getCoverage", async (req) => {
  const issueKey = issueKeyFrom(req);
  if (!issueKey) return { error: "No issue key in context." };
  return api(`/api/v1/jira/coverage?key=${encodeURIComponent(issueKey)}`);
});

resolver.define("searchTests", async (req) => {
  const issueKey = issueKeyFrom(req);
  if (!issueKey) return { error: "No issue key in context." };
  const query = req.payload?.query ?? "";
  return api(
    `/api/v1/jira/tests?issueKey=${encodeURIComponent(issueKey)}&query=${encodeURIComponent(query)}`,
  );
});

resolver.define("createTest", async (req) => {
  const issueKey = issueKeyFrom(req);
  if (!issueKey) return { error: "No issue key in context." };
  return api("/api/v1/jira/tests", {
    method: "POST",
    body: {
      issueKey,
      title: req.payload?.title,
      description: req.payload?.description,
      steps: req.payload?.steps,
    },
  });
});

resolver.define("linkTest", async (req) => {
  const issueKey = issueKeyFrom(req);
  if (!issueKey) return { error: "No issue key in context." };
  return api("/api/v1/jira/link", {
    method: "POST",
    body: { issueKey, caseKey: req.payload?.caseKey },
  });
});

resolver.define("recordResult", async (req) => {
  const issueKey = issueKeyFrom(req);
  if (!issueKey) return { error: "No issue key in context." };
  return api("/api/v1/jira/execute", {
    method: "POST",
    body: {
      issueKey,
      caseKey: req.payload?.caseKey,
      status: req.payload?.status,
      comment: req.payload?.comment,
    },
  });
});

resolver.define("getMetrics", async (req) => {
  const projectKey = req.payload?.projectKey;
  if (!projectKey) return { error: "No project configured for this gadget." };
  return api(`/api/v1/jira/metrics?projectKey=${encodeURIComponent(projectKey)}`);
});

resolver.define("getProjectOptions", async () => {
  return api("/api/v1/jira/metrics?projects=1");
});

export const handler = resolver.getDefinitions();
