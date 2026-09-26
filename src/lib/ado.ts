import { XMLParser } from "fast-xml-parser";

export type AdoStep = { action: string; expected: string | null };

function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "#text" in (value as object)) {
    const text = (value as { "#text": unknown })["#text"];
    return typeof text === "string" ? text : String(text ?? "");
  }
  return value == null ? "" : String(value);
}

/**
 * Parses the `Microsoft.VSTS.TCM.Steps` field of an Azure DevOps Test Case
 * (an XML/HTML-ish blob) into ordered action/expected steps.
 */
export function parseAdoSteps(field: string | null | undefined): AdoStep[] {
  if (!field) return [];

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  });

  let parsed: unknown;
  try {
    parsed = parser.parse(field);
  } catch {
    return [];
  }

  const root = parsed as { steps?: { step?: unknown } } | undefined;
  const raw = root?.steps?.step;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];

  const steps: AdoStep[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const rawStrings = record.parameterizedString;
    const strings = (Array.isArray(rawStrings) ? rawStrings : [rawStrings]).map(
      textOf,
    );
    const action = (strings[0] ?? "").trim();
    const expected = (strings[1] ?? "").trim() || null;
    if (!action && !expected) continue;
    steps.push({ action, expected });
  }
  return steps;
}
