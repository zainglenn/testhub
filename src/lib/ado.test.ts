import { describe, expect, it } from "vitest";
import { parseAdoSteps } from "./ado";

const STEPS = `<steps id="0" last="2"><step id="1" type="ValidateStep"><parameterizedString isformatted="true">Open the catalogue</parameterizedString><parameterizedString isformatted="true">The catalogue is shown</parameterizedString></step><step id="2" type="ValidateStep"><parameterizedString isformatted="true">Search for shoes</parameterizedString><parameterizedString isformatted="true">Results are shown</parameterizedString></step></steps>`;

describe("parseAdoSteps", () => {
  it("parses ordered action/expected steps", () => {
    expect(parseAdoSteps(STEPS)).toEqual([
      { action: "Open the catalogue", expected: "The catalogue is shown" },
      { action: "Search for shoes", expected: "Results are shown" },
    ]);
  });

  it("handles an empty value", () => {
    expect(parseAdoSteps(null)).toEqual([]);
    expect(parseAdoSteps("")).toEqual([]);
  });
});
