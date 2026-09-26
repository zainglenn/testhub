import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "./csv";

describe("parseCsv", () => {
  it("parses simple rows", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("handles quoted fields with commas and escaped quotes", () => {
    expect(parseCsv('a,"b,c"\n"d""e",f')).toEqual([
      ["a", "b,c"],
      ['d"e', "f"],
    ]);
  });

  it("handles CRLF and a trailing newline", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("strips a leading BOM", () => {
    expect(parseCsv("\uFEFFa,b")).toEqual([["a", "b"]]);
  });
});

describe("toCsv", () => {
  it("quotes fields containing commas or quotes", () => {
    expect(toCsv([["a", "b,c"], ['d"e', "f"]])).toBe('a,"b,c"\r\n"d""e",f');
  });

  it("round-trips through parseCsv", () => {
    const rows = [
      ["Title", "Steps"],
      ["Case one", "a => b | c => d"],
      ["Quote, comma", 'x "y"'],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});
