import { describe, expect, it } from "vitest";
import { parseGaugeMachine, parseGaugeReport, parseGaugeSpec } from "./gauge";

const SPEC = `# Search

Search behaviour

## Search returns products
tags: smoke, search
Matches products by free text.
* Open the catalogue
* Search for "shoes"
`;

describe("parseGaugeSpec", () => {
  it("parses the spec title, scenario, tags and steps", () => {
    const spec = parseGaugeSpec(SPEC);
    expect(spec.title).toBe("Search");
    expect(spec.description).toBe("Search behaviour");
    expect(spec.scenarios).toHaveLength(1);
    const scenario = spec.scenarios[0];
    expect(scenario.title).toBe("Search returns products");
    expect(scenario.tags).toEqual(["smoke", "search"]);
    expect(scenario.description).toBe("Matches products by free text.");
    expect(scenario.steps).toEqual([
      "Open the catalogue",
      'Search for "shoes"',
    ]);
  });
});

describe("parseGaugeReport", () => {
  it("maps scenario statuses from the JSON report", () => {
    const json = JSON.stringify({
      specs: [
        {
          specFile: "specs/search.spec",
          scenarios: [
            { scenarioHeading: "Search returns products", result: { status: "passed" } },
            { scenarioHeading: "No duplicates", result: { status: "failed" } },
            { scenarioHeading: "Skipped one", executionStatus: "skipped" },
          ],
        },
      ],
    });
    expect(parseGaugeReport(json)).toEqual([
      { name: "Search returns products", classname: "specs/search.spec", status: "PASS" },
      { name: "No duplicates", classname: "specs/search.spec", status: "FAIL" },
      { name: "Skipped one", classname: "specs/search.spec", status: "SKIPPED" },
    ]);
  });

  it("returns an empty array for invalid JSON", () => {
    expect(parseGaugeReport("not json")).toEqual([]);
  });
});

const MACHINE = [
  '{"type":"specStart","id":"s1","name":"Search","fileName":"specs/search.spec"}',
  '{"type":"scenarioStart","id":"sc1","name":"Search returns products"}',
  '{"type":"stepStart","id":"st1","name":"Open the catalogue"}',
  '{"type":"stepEnd","id":"st1","name":"Open the catalogue","result":{"status":"pass"}}',
  '{"type":"stepStart","id":"st2","name":"Search for shoes"}',
  '{"type":"stepEnd","id":"st2","name":"Search for shoes","result":{"status":"fail"},"screenshot":"screenshots/fail.png"}',
  '{"type":"scenarioEnd","id":"sc1","name":"Search returns products","result":{"status":"fail"}}',
  '{"type":"specEnd","id":"s1","name":"Search","fileName":"specs/search.spec","result":{"status":"fail"}}',
].join("\n");

describe("parseGaugeMachine", () => {
  it("parses per-step statuses from the NDJSON stream", () => {
    const scenarios = parseGaugeMachine(MACHINE);
    expect(scenarios).toHaveLength(1);
    const scenario = scenarios[0];
    expect(scenario.specFile).toBe("specs/search.spec");
    expect(scenario.scenarioName).toBe("Search returns products");
    expect(scenario.status).toBe("FAIL");
    expect(scenario.steps).toEqual([
      { index: 1, name: "Open the catalogue", status: "PASS", screenshot: null },
      {
        index: 2,
        name: "Search for shoes",
        status: "FAIL",
        screenshot: "screenshots/fail.png",
      },
    ]);
  });

  it("returns an empty array for the summarized JSON form", () => {
    expect(
      parseGaugeMachine(JSON.stringify({ specs: [{ scenarios: [] }] })),
    ).toEqual([]);
  });
});
