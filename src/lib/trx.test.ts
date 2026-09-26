import { describe, expect, it } from "vitest";
import { parseTrx } from "./trx";

const TRX = `<?xml version="1.0" encoding="UTF-8"?>
<TestRun>
  <Results>
    <UnitTestResult testName="Portal.Tests.SearchTests.ReturnsProducts" outcome="Passed" />
    <UnitTestResult testName="Portal.Tests.SearchTests.NoDuplicates" outcome="Failed" />
    <UnitTestResult testName="Portal.Tests.SearchTests.SkippedOne" outcome="NotExecuted" />
  </Results>
</TestRun>`;

describe("parseTrx", () => {
  it("maps outcomes and splits classname/name", () => {
    expect(parseTrx(TRX)).toEqual([
      { name: "ReturnsProducts", classname: "Portal.Tests.SearchTests", status: "PASS" },
      { name: "NoDuplicates", classname: "Portal.Tests.SearchTests", status: "FAIL" },
      { name: "SkippedOne", classname: "Portal.Tests.SearchTests", status: "SKIPPED" },
    ]);
  });

  it("returns an empty array when there are no results", () => {
    expect(parseTrx("<TestRun><Results/></TestRun>")).toEqual([]);
  });
});
