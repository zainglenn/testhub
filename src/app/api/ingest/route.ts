import crypto from "node:crypto";
import { hashToken } from "@/lib/api-token";
import {
  parseGaugeMachine,
  parseGaugeReport,
  type GaugeMachineScenario,
  type GaugeMachineStep,
} from "@/lib/gauge";
import { parseJUnit } from "@/lib/junit";
import { prisma } from "@/lib/prisma";
import { isStorageConfigured, uploadObject } from "@/lib/supabase-storage";
import { parseTrx } from "@/lib/trx";

export const dynamic = "force-dynamic";

const MAX_EVIDENCE_BYTES = 10_000_000;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extensionOf(filename: string): string {
  return (filename.match(/\.[A-Za-z0-9]{1,12}$/)?.[0] ?? "").toLowerCase();
}

function mimeFor(filename: string): string {
  const ext = extensionOf(filename);
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".json") return "application/json";
  if (ext === ".txt" || ext === ".log") return "text/plain";
  return "application/octet-stream";
}

type MatchItem = { classname?: string; name?: string; status: string };
type AttachmentInput = {
  name: string;
  dataBase64: string;
  caseKey?: string;
  stepIndex?: number;
};

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
    gaugeMachine?: unknown;
    attachments?: unknown;
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
  const gaugeMachine =
    typeof body.gaugeMachine === "string" ? body.gaugeMachine : null;

  // Machine-readable Gauge carries per-step results; fall back to the summarized
  // shapes otherwise.
  let items: MatchItem[] | null = null;
  const stepPlan = new Map<string, GaugeMachineStep[]>();
  let machineScenarios: GaugeMachineScenario[] = [];

  if (gaugeMachine) {
    const scenarios = parseGaugeMachine(gaugeMachine);
    if (scenarios.length > 0) {
      machineScenarios = scenarios;
      items = scenarios.map((scenario) => ({
        classname: scenario.specFile,
        name: scenario.scenarioName,
        status: scenario.status,
      }));
    }
  }

  if (!items) {
    const results = junit
      ? parseJUnit(junit)
      : trx
        ? parseTrx(trx)
        : gauge
          ? parseGaugeReport(gauge)
          : null;
    items = results;
  }

  if (!items) {
    return Response.json(
      {
        error:
          "Provide one of: 'junit', 'trx', 'gauge' (summarized JSON) or 'gaugeMachine' (NDJSON).",
      },
      { status: 400 },
    );
  }
  if (items.length === 0) {
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
  const keyPattern = new RegExp(`\\b${escapeRegExp(project.key)}-(\\d+)\\b`, "i");

  function resolveCaseId(classname: string, name: string): string | undefined {
    const keyMatch = `${classname} ${name}`.match(keyPattern);
    let testCaseId = keyMatch
      ? byKey.get(`${project.key}-${keyMatch[1]}`)
      : undefined;
    if (!testCaseId && name) {
      testCaseId = byTitle.get(name.trim().toLowerCase());
    }
    return testCaseId;
  }

  const matchedMap = new Map<string, string>();
  let unmatched = 0;

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const testCaseId = resolveCaseId(item.classname ?? "", item.name ?? "");
    if (!testCaseId) {
      unmatched += 1;
      continue;
    }
    matchedMap.set(testCaseId, item.status);
    const scenario = machineScenarios[index];
    if (scenario && scenario.steps.length > 0) {
      stepPlan.set(testCaseId, scenario.steps);
    }
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

  const executions = await prisma.testExecution.findMany({
    where: { runId: run.id },
    select: { id: true, testCaseId: true },
  });
  const executionByCase = new Map(
    executions.map((execution) => [execution.testCaseId, execution.id]),
  );

  // Per-step results for machine-readable Gauge.
  let stepCount = 0;
  if (stepPlan.size > 0) {
    const caseStepIds = await prisma.testCase.findMany({
      where: { id: { in: Array.from(stepPlan.keys()) } },
      select: { id: true, steps: { orderBy: { order: "asc" }, select: { id: true } } },
    });
    const stepIdsByCase = new Map(
      caseStepIds.map((row) => [row.id, row.steps.map((step) => step.id)]),
    );

    const rows: {
      executionId: string;
      testStepId: string | null;
      order: number;
      status: string;
    }[] = [];
    for (const [testCaseId, machineSteps] of stepPlan) {
      const executionId = executionByCase.get(testCaseId);
      if (!executionId) continue;
      const ids = stepIdsByCase.get(testCaseId) ?? [];
      machineSteps.forEach((step, index) => {
        rows.push({
          executionId,
          testStepId: ids[index] ?? null,
          order: index,
          status: step.status,
        });
      });
    }
    if (rows.length > 0) {
      await prisma.testExecutionStep.createMany({ data: rows });
      stepCount = rows.length;
    }
  }

  // Optional evidence (screenshots etc.) sent alongside the report.
  let evidenceCount = 0;
  let evidenceSkipped = 0;
  const attachments = Array.isArray(body.attachments)
    ? (body.attachments as AttachmentInput[])
    : [];
  if (attachments.length > 0) {
    if (!isStorageConfigured() || !project.workspaceId) {
      evidenceSkipped = attachments.length;
    } else {
      for (const attachment of attachments) {
        if (
          !attachment ||
          typeof attachment.name !== "string" ||
          typeof attachment.dataBase64 !== "string"
        ) {
          continue;
        }
        const testCaseId = attachment.caseKey
          ? (() => {
              const keyMatch = attachment.caseKey?.match(keyPattern);
              return keyMatch
                ? byKey.get(`${project.key}-${keyMatch[1]}`)
                : byTitle.get(attachment.caseKey!.trim().toLowerCase());
            })()
          : matched.length === 1
            ? matched[0].testCaseId
            : undefined;
        const executionId = testCaseId
          ? executionByCase.get(testCaseId)
          : undefined;
        if (!executionId) {
          evidenceSkipped += 1;
          continue;
        }

        const buffer = Buffer.from(attachment.dataBase64, "base64");
        if (buffer.length === 0 || buffer.length > MAX_EVIDENCE_BYTES) {
          evidenceSkipped += 1;
          continue;
        }

        let executionStepId: string | null = null;
        if (typeof attachment.stepIndex === "number") {
          const stepRow = await prisma.testExecutionStep.findUnique({
            where: {
              executionId_order: {
                executionId,
                order: Math.max(attachment.stepIndex - 1, 0),
              },
            },
            select: { id: true },
          });
          executionStepId = stepRow?.id ?? null;
        }

        const filename = attachment.name.slice(0, 200);
        const storageKey = `${crypto.randomUUID()}${extensionOf(filename)}`;
        try {
          await uploadObject(
            storageKey,
            buffer,
            mimeFor(filename),
          );
        } catch {
          evidenceSkipped += 1;
          continue;
        }
        await prisma.evidence.create({
          data: {
            workspaceId: project.workspaceId,
            executionId,
            executionStepId,
            filename,
            mime: mimeFor(filename),
            size: buffer.length,
            storageKey,
          },
        });
        evidenceCount += 1;
      }
    }
  }

  return Response.json({
    runId: run.id,
    matched: matched.length,
    unmatched,
    failed: matched.filter((item) => item.status === "FAIL").length,
    steps: stepCount,
    evidence: evidenceCount,
    evidenceSkipped,
  });
}
