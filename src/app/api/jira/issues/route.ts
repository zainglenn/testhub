import { NextRequest, NextResponse } from "next/server";
import { getJiraConnection, searchIssues } from "@/lib/jira/client";

export const dynamic = "force-dynamic";

const ISSUE_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]*-\d+$/;

export async function GET(request: NextRequest) {
  const connection = await getJiraConnection();
  if (!connection) {
    return NextResponse.json(
      { error: "Jira is not connected" },
      { status: 400 },
    );
  }

  const query = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (query.length < 2) {
    return NextResponse.json({ issues: [] });
  }

  const escaped = query.replace(/["\\]/g, "\\$&");
  const jql = ISSUE_KEY_PATTERN.test(query)
    ? `key = "${escaped}"`
    : `text ~ "${escaped}*" ORDER BY updated DESC`;

  try {
    const issues = await searchIssues(jql, 15);
    return NextResponse.json({
      issues: issues.map((issue) => ({
        key: issue.key,
        summary: issue.fields.summary ?? "",
        type: issue.fields.issuetype?.name ?? "",
        status: issue.fields.status?.name ?? "",
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed" },
      { status: 500 },
    );
  }
}
