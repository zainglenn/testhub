import { linkTest } from "@/lib/jira/panel-actions";
import { authenticatePanel } from "@/lib/jira/panel-auth";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-jira-panel-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
} as const;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: CORS_HEADERS });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  const authError = await authenticatePanel(request, "link");
  if (authError) return authError;

  let body: { issueKey?: string; caseKey?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const issueKey = (body.issueKey ?? "").trim();
  const caseKey = (body.caseKey ?? "").trim();
  if (!issueKey || !caseKey) {
    return json({ error: "issueKey and caseKey are required." }, 400);
  }

  const result = await linkTest({ issueKey, caseKey });
  return json(result, "error" in result ? 400 : 200);
}
