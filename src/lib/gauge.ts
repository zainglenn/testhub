export type GaugeScenario = {
  title: string;
  tags: string[];
  description: string | null;
  steps: string[];
};

export type GaugeSpec = {
  title: string;
  description: string | null;
  scenarios: GaugeScenario[];
};

export type IngestResult = {
  name?: string;
  classname?: string;
  status: "PASS" | "FAIL" | "SKIPPED";
};

/**
 * Parses a Gauge `.spec` file: `# Spec`, `## Scenario`, `tags:`, and `* step`
 * lines, with free text treated as the description.
 */
export function parseGaugeSpec(text: string): GaugeSpec {
  const lines = text.split(/\r?\n/);
  const spec: GaugeSpec = { title: "", description: null, scenarios: [] };
  const specDescription: string[] = [];

  let scenario: GaugeScenario | null = null;
  const scenarioDescription: string[] = [];

  const flush = () => {
    if (!scenario) return;
    scenario.description = scenarioDescription.join("\n").trim() || null;
    spec.scenarios.push(scenario);
    scenario = null;
    scenarioDescription.length = 0;
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");

    if (line.startsWith("# ")) {
      spec.title = line.slice(2).trim();
      continue;
    }
    if (line.startsWith("## ")) {
      flush();
      scenario = { title: line.slice(3).trim(), tags: [], description: null, steps: [] };
      continue;
    }
    if (!scenario) {
      if (line.trim()) specDescription.push(line.trim());
      continue;
    }
    if (/^\s*tags:/.test(line)) {
      scenario.tags.push(
        ...line
          .replace(/^\s*tags:/, "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      );
      continue;
    }
    if (line.startsWith("* ")) {
      scenario.steps.push(line.slice(2).trim());
      continue;
    }
    if (!line.trim()) continue;
    if (line.trimStart().startsWith("|")) continue;
    if (scenario.steps.length === 0) scenarioDescription.push(line.trim());
  }
  flush();

  spec.description = specDescription.join(" ").trim() || null;
  return spec;
}

function mapStatus(status: string | undefined): IngestResult["status"] {
  switch ((status ?? "").toLowerCase()) {
    case "failed":
    case "fail":
      return "FAIL";
    case "skipped":
    case "skip":
      return "SKIPPED";
    default:
      return "PASS";
  }
}

type GaugeReportScenario = {
  name?: string;
  scenarioHeading?: string;
  heading?: string;
  executionStatus?: string;
  status?: string;
  result?: { status?: string };
};

type GaugeReportSpec = {
  specFile?: string;
  name?: string;
  fileName?: string;
  scenarios?: GaugeReportScenario[];
};

/** Parses Gauge's machine-readable JSON report (`gauge run --machine-readable`). */
export function parseGaugeReport(json: string): IngestResult[] {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return [];
  }

  const root = data as { specs?: GaugeReportSpec[] };
  const specs = Array.isArray(root?.specs)
    ? root.specs
    : Array.isArray(data)
      ? (data as GaugeReportSpec[])
      : [];

  const results: IngestResult[] = [];
  for (const spec of specs) {
    const specFile = spec.specFile ?? spec.name ?? spec.fileName ?? "";
    for (const scenario of spec.scenarios ?? []) {
      const name = scenario.scenarioHeading ?? scenario.name ?? scenario.heading;
      if (!name) continue;
      const status =
        scenario.result?.status ?? scenario.executionStatus ?? scenario.status;
      results.push({ name, classname: specFile, status: mapStatus(status) });
    }
  }
  return results;
}

export type GaugeMachineStep = {
  index: number;
  name: string;
  status: IngestResult["status"];
  screenshot: string | null;
};

export type GaugeMachineScenario = {
  specName: string;
  specFile: string;
  scenarioName: string;
  status: IngestResult["status"];
  steps: GaugeMachineStep[];
};

function deriveScenarioStatus(
  steps: GaugeMachineStep[],
): IngestResult["status"] {
  if (steps.some((step) => step.status === "FAIL")) return "FAIL";
  if (steps.some((step) => step.status === "SKIPPED")) return "SKIPPED";
  return "PASS";
}

type GaugeMessage = {
  type?: string;
  id?: string;
  name?: string;
  stepText?: string;
  fileName?: string;
  isBeforeStep?: boolean;
  isAfterStep?: boolean;
  screenshot?: string;
  status?: string;
  result?: { status?: string; screenshot?: string };
};

/**
 * Parses Gauge's `--machine-readable` NDJSON stream into specs/scenarios with
 * per-step results (and any screenshot path Gauge attached to a step). Returns
 * an empty array when the input is the summarized JSON form (handled by
 * `parseGaugeReport`).
 */
export function parseGaugeMachine(text: string): GaugeMachineScenario[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // A single summarized JSON document is not NDJSON.
  if (trimmed.startsWith("{") && !trimmed.includes("\n")) {
    try {
      const parsed = JSON.parse(trimmed) as { specs?: unknown };
      if (Array.isArray(parsed.specs)) return [];
    } catch {
      // Fall through and try NDJSON.
    }
  }

  const scenarios: GaugeMachineScenario[] = [];
  let specName = "";
  let specFile = "";
  let scenarioName = "";
  let steps: GaugeMachineStep[] = [];
  const pending = new Map<string, GaugeMachineStep>();

  const flush = (status?: IngestResult["status"]) => {
    if (!scenarioName && steps.length === 0) return;
    scenarios.push({
      specName,
      specFile,
      scenarioName,
      status: status ?? deriveScenarioStatus(steps),
      steps,
    });
    scenarioName = "";
    steps = [];
    pending.clear();
  };

  for (const rawLine of trimmed.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith("{")) continue;
    let message: GaugeMessage;
    try {
      message = JSON.parse(line) as GaugeMessage;
    } catch {
      continue;
    }

    switch (message.type) {
      case "specStart":
        specName = message.name ?? "";
        specFile = message.fileName ?? "";
        break;
      case "specEnd":
        if (message.fileName) specFile = message.fileName;
        if (message.name) specName = message.name;
        break;
      case "scenarioStart":
        scenarioName = message.name ?? message.stepText ?? "";
        steps = [];
        pending.clear();
        break;
      case "stepStart": {
        const name = message.name ?? message.stepText ?? "";
        if (
          !name ||
          name.startsWith("__gauge_") ||
          message.isBeforeStep ||
          message.isAfterStep
        ) {
          break;
        }
        const step: GaugeMachineStep = {
          index: steps.length + 1,
          name,
          status: "PASS",
          screenshot: null,
        };
        pending.set(String(message.id ?? name), step);
        steps.push(step);
        break;
      }
      case "stepEnd": {
        const step = pending.get(String(message.id ?? message.name ?? ""));
        if (!step) break;
        step.status = mapStatus(
          message.result?.status ?? message.status,
        ) as GaugeMachineStep["status"];
        step.screenshot =
          message.screenshot ?? message.result?.screenshot ?? null;
        break;
      }
      case "scenarioEnd":
        flush(
          mapStatus(
            message.result?.status ?? message.status,
          ) as GaugeMachineScenario["status"],
        );
        break;
      default:
        break;
    }
  }

  flush();
  return scenarios;
}
