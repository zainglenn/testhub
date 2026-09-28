#!/usr/bin/env node
// TestHub CI ingest helper.
//
// Sends a test report to TestHub's `/api/ingest`, including per-step results
// (Gauge `--machine-readable`) and screenshots as evidence.
//
// Usage:
//   node scripts/gauge-ingest.mjs --report gauge.ndjson --token "$TESTHUB_TOKEN" \
//     --screenshots ./reports/html-report/images --run-name "CI #123" --environment CI
//
//   node scripts/gauge-ingest.mjs --type junit --report junit.xml --token ... --api-url ...
//
// Env fallbacks: TESTHUB_TOKEN, TESTHUB_API_URL (default https://testhub-one.vercel.app).

import { readFileSync, existsSync } from "node:fs";
import { basename, dirname, isAbsolute, join } from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const apiUrl = (args["api-url"] || process.env.TESTHUB_API_URL || "https://testhub-one.vercel.app").replace(/\/$/, "");
const token = args.token || process.env.TESTHUB_TOKEN;
const type = args.type || "gauge";
const reportPath = args.report;
const screenshotsDir = args.screenshots || null;
const runName = args["run-name"] || null;
const environment = args.environment || null;
const dryRun = Boolean(args["dry-run"]);

if (!reportPath) {
  console.error("Error: --report <path> is required.");
  process.exit(1);
}
if (!token) {
  console.error("Error: --token or TESTHUB_TOKEN is required.");
  process.exit(1);
}
if (!existsSync(reportPath)) {
  console.error(`Error: report not found: ${reportPath}`);
  process.exit(1);
}

const reportText = readFileSync(reportPath, "utf8");
const reportDir = dirname(reportPath);

const CASE_KEY_RE = /^[A-Z][A-Z0-9_]*-\d+$/;

function caseKeyFromTags(tags) {
  if (!Array.isArray(tags)) return undefined;
  const match = tags.map(String).find((tag) => CASE_KEY_RE.test(tag.trim()));
  return match ? match.trim() : undefined;
}

function resolveScreenshot(pathValue) {
  const candidates = [
    pathValue,
    screenshotsDir ? join(screenshotsDir, basename(pathValue)) : null,
    join(reportDir, pathValue),
  ].filter(Boolean);
  if (isAbsolute(pathValue) && existsSync(pathValue)) return pathValue;
  return candidates.find((candidate) => existsSync(candidate)) || null;
}

/** Parses Gauge `--machine-readable` NDJSON into scenarios with step screenshots. */
function parseGauge(report) {
  const scenarios = [];
  let specFile = "";
  let specName = "";
  let current = null;
  const pendingSteps = new Map();

  for (const line of report.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    let message;
    try {
      message = JSON.parse(trimmed);
    } catch {
      continue;
    }
    switch (message.type) {
      case "specStart":
      case "specEnd":
        specName = message.name || specName;
        specFile = message.fileName || specFile;
        break;
      case "scenarioStart":
        current = {
          name: message.name || "",
          tags: message.tags || [],
          steps: [],
        };
        pendingSteps.clear();
        break;
      case "stepStart": {
        const name = message.name || "";
        if (!name || name.startsWith("__gauge_") || message.isBeforeStep || message.isAfterStep) break;
        const step = { index: current ? current.steps.length + 1 : 1, name, screenshot: null };
        pendingSteps.set(String(message.id || name), step);
        if (current) current.steps.push(step);
        break;
      }
      case "stepEnd": {
        const step = pendingSteps.get(String(message.id || message.name || ""));
        if (!step) break;
        const shot = message.screenshot || message.result?.screenshot || (Array.isArray(message.screenshots) ? message.screenshots[0] : null);
        if (shot) step.screenshot = shot;
        break;
      }
      case "scenarioEnd":
        if (current) {
          scenarios.push({ ...current, specName, specFile, tags: current.tags?.length ? current.tags : message.tags || [] });
          current = null;
        }
        break;
      default:
        break;
    }
  }
  return scenarios;
}

function buildGaugeAttachments(scenarios) {
  const attachments = [];
  for (const scenario of scenarios) {
    const caseKey = caseKeyFromTags(scenario.tags);
    for (const step of scenario.steps) {
      if (!step.screenshot) continue;
      const resolved = resolveScreenshot(step.screenshot);
      if (!resolved) continue;
      const data = readFileSync(resolved);
      attachments.push({
        name: basename(resolved),
        dataBase64: data.toString("base64"),
        ...(caseKey ? { caseKey } : {}),
        stepIndex: step.index,
      });
    }
  }
  return attachments;
}

async function main() {
  let body;
  if (type === "junit") {
    body = { junit: reportText };
  } else if (type === "gauge") {
    const scenarios = parseGauge(reportText);
    const attachments = buildGaugeAttachments(scenarios);
    body = { gaugeMachine: reportText, attachments };
    console.log(`Parsed ${scenarios.length} scenario(s), ${attachments.length} screenshot(s).`);
  } else {
    console.error(`Error: unknown --type "${type}" (use "gauge" or "junit").`);
    process.exit(1);
  }

  if (runName) body.runName = runName;
  if (environment) body.environment = environment;

  if (dryRun) {
    const preview = { ...body };
    if (preview.attachments) {
      preview.attachments = preview.attachments.map((a) => ({ ...a, dataBase64: `<${a.dataBase64.length} b64 chars>` }));
    }
    if (preview.gaugeMachine) preview.gaugeMachine = `<${preview.gaugeMachine.length} chars>`;
    if (preview.junit) preview.junit = `<${preview.junit.length} chars>`;
    console.log("Dry run:", JSON.stringify(preview, null, 2));
    return;
  }

  const response = await fetch(`${apiUrl}/api/ingest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  console.log(`TestHub responded ${response.status}: ${text}`);
  if (!response.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
