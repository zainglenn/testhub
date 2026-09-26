import { XMLParser } from "fast-xml-parser";

export type JunitResult = {
  name?: string;
  classname?: string;
  status: "PASS" | "FAIL" | "SKIPPED";
};

function stringAttr(object: Record<string, unknown>, key: string): string | undefined {
  const value = object[key];
  return typeof value === "string" ? value : undefined;
}

function collect(node: unknown, out: JunitResult[]): void {
  if (Array.isArray(node)) {
    for (const item of node) collect(item, out);
    return;
  }
  if (!node || typeof node !== "object") return;

  const record = node as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (key === "testcase") {
      const cases = Array.isArray(value) ? value : [value];
      for (const item of cases) {
        if (!item || typeof item !== "object") continue;
        const testCase = item as Record<string, unknown>;
        const status: JunitResult["status"] =
          "failure" in testCase || "error" in testCase
            ? "FAIL"
            : "skipped" in testCase
              ? "SKIPPED"
              : "PASS";
        out.push({
          name: stringAttr(testCase, "@_name"),
          classname: stringAttr(testCase, "@_classname"),
          status,
        });
      }
    } else {
      collect(value, out);
    }
  }
}

export function parseJUnit(xml: string): JunitResult[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  });
  const parsed = parser.parse(xml);
  const results: JunitResult[] = [];
  collect(parsed, results);
  return results;
}
