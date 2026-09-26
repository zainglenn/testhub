import { describe, expect, it } from "vitest";
import { parseGaugeReport, parseGaugeSpec } from "./gauge";

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
