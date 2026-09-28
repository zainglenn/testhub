import { createTest, listTests } from "@/lib/jira/panel-actions";
import { authenticatePanel } from "@/lib/jira/panel-auth";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-jira-panel-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
} as const;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: CORS_HEADERS });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: Request) {
  const authError = authenticatePanel(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const issueKey = (url.searchParams.get("issueKey") ?? url.searchParams.get("key") ?? "").trim();
  if (!issueKey) return json({ error: "Provide ?issueKey=PROJ-123." }, 400);

  const query = (url.searchParams.get("query") ?? "").trim() || undefined;
  const limit = Number(url.searchParams.get("limit") ?? "25") || 25;

  const result = await listTests({ issueKey, query, limit });
  return json(result, "error" in result ? 404 : 200);
}

export async function POST(request: Request) {
  const authError = authenticatePanel(request);
  if (authError) return authError;

  let body: {
    issueKey?: string;
    title?: string;
    description?: string;
    steps?: { action?: string; expectedResult?: string }[];
  };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const issueKey = (body.issueKey ?? "").trim();
  if (!issueKey) return json({ error: "issueKey is required." }, 400);

  const result = await createTest({
    issueKey,
    title: body.title ?? "",
    description: body.description,
    steps: (body.steps ?? []).map((step) => ({
      action: step.action ?? "",
      expectedResult: step.expectedResult,
    })),
  });
  return json(result, "error" in result ? 400 : 200);
}
