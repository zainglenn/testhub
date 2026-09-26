import { hashToken } from "@/lib/api-token";
import { parseGaugeReport } from "@/lib/gauge";
import { parseJUnit } from "@/lib/junit";
import { prisma } from "@/lib/prisma";
import { parseTrx } from "@/lib/trx";

export const dynamic = "force-dynamic";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const provided = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : request.headers.get("x-api-token")?.trim();

  if (!provided) {
    return Response.json({ error: "Missing API token." }, { status: 401 });
  }

  const token = await prisma.apiToken.findUnique({
    where: { tokenHash: hashToken(provided) },
    include: { project: true },
  });
  if (!token) {
    return Response.json({ error: "Invalid API token." }, { status: 401 });
  }

  let body: {
    junit?: unknown;
    trx?: unknown;
    gauge?: unknown;
    runName?: unknown;
    environment?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const junit = typeof body.junit === "string" ? body.junit : null;
  const trx = typeof body.trx === "string" ? body.trx : null;
  const gauge = typeof body.gauge === "string" ? body.gauge : null;

  const results = junit
    ? parseJUnit(junit)
    : trx
      ? parseTrx(trx)
      : gauge
        ? parseGaugeReport(gauge)
        : null;

  if (!results) {
    return Response.json(
      {
        error:
          "Provide one of: 'junit' (JUnit XML), 'trx' (VSTest TRX) or 'gauge' (Gauge JSON).",
      },
      { status: 400 },
    );
  }

  if (results.length === 0) {
    return Response.json(
      { error: "No test results found in the provided report." },
      { status: 400 },
    );
  }

  const project = token.project;
  const cases = await prisma.testCase.findMany({
    where: { projectId: project.id },
    select: { id: true, number: true, title: true },
  });

  const byKey = new Map(cases.map((c) => [`${project.key}-${c.number}`, c.id]));
  const byTitle = new Map(cases.map((c) => [c.title.trim().toLowerCase(), c.id]));
  const keyPattern = new RegExp(
    `\\b${escapeRegExp(project.key)}-(\\d+)\\b`,
    "i",
  );

  const matchedMap = new Map<string, string>();
  let unmatched = 0;

  for (const result of results) {
    const haystack = `${result.classname ?? ""} ${result.name ?? ""}`;
    const keyMatch = haystack.match(keyPattern);
    let testCaseId = keyMatch
      ? byKey.get(`${project.key}-${keyMatch[1]}`)
      : undefined;
    if (!testCaseId && result.name) {
      testCaseId = byTitle.get(result.name.trim().toLowerCase());
    }
    if (!testCaseId) {
      unmatched += 1;
      continue;
    }
    matchedMap.set(testCaseId, result.status);
  }

  const now = new Date();
  await prisma.apiToken.update({
    where: { id: token.id },
    data: { lastUsedAt: now },
  });

  const matched = Array.from(matchedMap, ([testCaseId, status]) => ({
    testCaseId,
    status,
  }));

  if (matched.length === 0) {
    return Response.json({
      runId: null,
      matched: 0,
      unmatched,
      message: "No test cases matched this project.",
    });
  }

  const runName = (
    typeof body.runName === "string" && body.runName.trim()
      ? body.runName.trim()
      : `CI run ${now.toISOString()}`
  ).slice(0, 160);

  const environment =
    typeof body.environment === "string" && body.environment.trim()
      ? body.environment.trim()
      : null;

  const run = await prisma.$transaction(async (tx) => {
    const created = await tx.testRun.create({
      data: {
        projectId: project.id,
        name: runName,
        environment,
        status: "COMPLETED",
        completedAt: now,
      },
    });

    await tx.testRunItem.createMany({
      data: matched.map((item, index) => ({
        runId: created.id,
        testCaseId: item.testCaseId,
        order: index,
      })),
    });

    await tx.testExecution.createMany({
      data: matched.map((item) => ({
        runId: created.id,
        testCaseId: item.testCaseId,
        projectId: project.id,
        status: item.status,
        executedAt: now,
      })),
    });

    return created;
  });

  return Response.json({
    runId: run.id,
    matched: matched.length,
    unmatched,
    failed: matched.filter((item) => item.status === "FAIL").length,
  });
}
