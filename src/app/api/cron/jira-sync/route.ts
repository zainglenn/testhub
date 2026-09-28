import crypto from "node:crypto";
import { runJiraSync } from "@/lib/jira/sync-all";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function secretMatches(provided: string | null): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Scheduled Jira sync. Vercel Cron calls this with `Authorization: Bearer
 * <CRON_SECRET>`; it can also be triggered manually with `?secret=`.
 */
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return Response.json({ error: "CRON_SECRET is not set." }, { status: 503 });
  }

  const header = request.headers.get("authorization") ?? "";
  const provided = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : new URL(request.url).searchParams.get("secret");

  if (!secretMatches(provided)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await runJiraSync();
    return Response.json({ ok: true, ...result, at: new Date().toISOString() });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Sync failed.",
      },
      { status: 500 },
    );
  }
}
