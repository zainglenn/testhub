import { graphql } from "graphql";
import { hashToken } from "@/lib/api-token";
import { rootValue, schema, type GraphQLContext } from "@/lib/graphql/api";
import { prisma } from "@/lib/prisma";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
} as const;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: CORS_HEADERS });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

async function authenticate(
  request: Request,
): Promise<{ ctx: GraphQLContext } | { status: number; body: unknown }> {
  const header = request.headers.get("authorization") ?? "";
  const provided = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : request.headers.get("x-api-token")?.trim();
  if (!provided) {
    return { status: 401, body: { errors: [{ message: "Missing credentials." }] } };
  }

  const appBase = (process.env.APP_BASE_URL ?? "").replace(/\/$/, "");
  const token = await prisma.apiToken.findUnique({
    where: { tokenHash: hashToken(provided) },
    select: { projectId: true },
  });
  if (token) {
    return { ctx: { scopedProjectId: token.projectId, appBase } };
  }
  const panel = process.env.JIRA_PANEL_SECRET;
  if (panel && panel === provided) {
    return { ctx: { appBase } };
  }
  return { status: 401, body: { errors: [{ message: "Invalid credentials." }] } };
}

async function execute(
  source: string,
  variableValues: Record<string, unknown>,
  contextValue: GraphQLContext,
) {
  const result = await graphql({
    schema,
    source,
    rootValue,
    variableValues,
    contextValue,
  });
  return json({
    data: result.data ?? null,
    errors: result.errors?.map((error) => ({ message: error.message })),
  });
}

export async function POST(request: Request) {
  const authResult = await authenticate(request);
  if ("status" in authResult) return json(authResult.body, authResult.status);

  const limited = rateLimitResponse(
    await rateLimit({
      key: `graphql:${authResult.ctx.scopedProjectId ?? "panel"}`,
      limit: 120,
      windowMs: 60_000,
    }),
  );
  if (limited) return limited;

  let body: { query?: unknown; variables?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ errors: [{ message: "Invalid JSON body." }] }, 400);
  }
  if (typeof body.query !== "string" || !body.query.trim()) {
    return json({ errors: [{ message: "Missing query." }] }, 400);
  }
  return execute(
    body.query,
    (body.variables as Record<string, unknown>) ?? {},
    authResult.ctx,
  );
}

export async function GET(request: Request) {
  const authResult = await authenticate(request);
  if ("status" in authResult) return json(authResult.body, authResult.status);

  const limited = rateLimitResponse(
    await rateLimit({
      key: `graphql:${authResult.ctx.scopedProjectId ?? "panel"}`,
      limit: 120,
      windowMs: 60_000,
    }),
  );
  if (limited) return limited;

  const url = new URL(request.url);
  const source = url.searchParams.get("query");
  if (!source) return json({ errors: [{ message: "Missing query." }] }, 400);

  let variableValues: Record<string, unknown> = {};
  const rawVariables = url.searchParams.get("variables");
  if (rawVariables) {
    try {
      variableValues = JSON.parse(rawVariables) as Record<string, unknown>;
    } catch {
      // Ignore malformed variables.
    }
  }
  return execute(source, variableValues, authResult.ctx);
}
