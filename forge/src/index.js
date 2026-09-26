import Resolver from "@forge/resolver";

const resolver = new Resolver();

const BASE_URL = process.env.TESTHUB_BASE_URL ?? "https://testhub-one.vercel.app";

resolver.define("getCoverage", async (req) => {
  const context = req.context ?? {};
  const issueKey =
    context.extension?.issue?.key ??
    context.platformContext?.issueKey ??
    req.payload?.key;

  if (!issueKey) {
    return { error: "No issue key in context." };
  }

  const secret = process.env.TESTHUB_PANEL_SECRET;
  if (!secret) {
    return { error: "TESTHUB_PANEL_SECRET is not configured for this app." };
  }

  const url = `${BASE_URL}/api/v1/jira/coverage?key=${encodeURIComponent(issueKey)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${secret}`, Accept: "application/json" },
  });

  if (!response.ok) {
    const body = await response.text();
    return {
      error: `TestHub API responded ${response.status}: ${body.slice(0, 200)}`,
    };
  }

  return await response.json();
});

export const handler = resolver.getDefinitions();
