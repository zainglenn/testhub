// JQL function handlers for the TestHub Forge app. Each returns a JQL fragment
// built from issue keys resolved from the TestHub API.

const BASE_URL = process.env.TESTHUB_BASE_URL ?? "https://testhub-one.vercel.app";

async function keysFor(name) {
  const secret = process.env.TESTHUB_PANEL_SECRET;
  if (!secret) {
    throw new Error("TESTHUB_PANEL_SECRET is not configured for this app.");
  }
  const response = await fetch(
    `${BASE_URL}/api/v1/jira/jql-issues?name=${encodeURIComponent(name)}`,
    { headers: { Authorization: `Bearer ${secret}`, Accept: "application/json" } },
  );
  if (!response.ok) {
    throw new Error(`TestHub responded ${response.status}`);
  }
  const data = await response.json();
  return Array.isArray(data.keys) ? data.keys : [];
}

function toJql(keys) {
  if (keys.length === 0) return "id in (-1)";
  return `key in (${keys.join(", ")})`;
}

export const failing = async () => ({
  jql: toJql(await keysFor("testHubFailing")),
});

export const hasTests = async () => ({
  jql: toJql(await keysFor("testHubHasTests")),
});

export const untested = async () => ({
  jql: toJql(await keysFor("testHubUntested")),
});
