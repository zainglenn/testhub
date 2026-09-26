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
