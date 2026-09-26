import { XMLParser } from "fast-xml-parser";
import type { IngestResult } from "./gauge";

function mapOutcome(outcome: string | undefined): IngestResult["status"] {
  switch ((outcome ?? "").toLowerCase()) {
    case "passed":
      return "PASS";
    case "failed":
    case "error":
      return "FAIL";
    case "notexecuted":
    case "skipped":
    case "aborted":
      return "SKIPPED";
    default:
      return "PASS";
  }
}

/**
 * Parses a Visual Studio / Azure DevOps TRX test report. The test name is split
 * into `classname` + `name` so the caller can match on either.
 */
export function parseTrx(xml: string): IngestResult[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  });
  const parsed = parser.parse(xml) as Record<string, unknown>;

  const testRun = (parsed?.TestRun ?? {}) as Record<string, unknown>;
  const resultsNode = testRun.Results as Record<string, unknown> | undefined;
  const raw = resultsNode?.UnitTestResult;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];

  const results: IngestResult[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const testName =
      typeof record["@_testName"] === "string" ? record["@_testName"] : undefined;
    if (!testName) continue;
    const outcome =
      typeof record["@_outcome"] === "string" ? record["@_outcome"] : undefined;

    const separator = testName.lastIndexOf(".");
    results.push({
      name: separator >= 0 ? testName.slice(separator + 1) : testName,
      classname: separator >= 0 ? testName.slice(0, separator) : testName,
      status: mapOutcome(outcome),
    });
  }
  return results;
}
