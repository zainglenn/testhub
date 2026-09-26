import { describe, expect, it } from "vitest";
import { parseJUnit } from "./junit";

const REPORT = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites tests="3">
  <testsuite name="checkout">
    <testcase classname="SHOP-1" name="SHOP-1 Sign in"/>
    <testcase classname="SHOP-2" name="SHOP-2 Reject"><failure message="boom"/></testcase>
    <testcase classname="SHOP-3" name="SHOP-3 Skip"><skipped/></testcase>
  </testsuite>
</testsuites>`;

describe("parseJUnit", () => {
  it("maps testcase outcomes to PASS / FAIL / SKIPPED", () => {
    expect(parseJUnit(REPORT)).toEqual([
      { name: "SHOP-1 Sign in", classname: "SHOP-1", status: "PASS" },
      { name: "SHOP-2 Reject", classname: "SHOP-2", status: "FAIL" },
      { name: "SHOP-3 Skip", classname: "SHOP-3", status: "SKIPPED" },
    ]);
  });

  it("treats <error> as FAIL", () => {
    const xml = `<testsuite><testcase name="x"><error/></testcase></testsuite>`;
    expect(parseJUnit(xml)[0]?.status).toBe("FAIL");
  });

  it("handles a single testsuite root", () => {
    const xml = `<testsuite><testcase name="only"/></testsuite>`;
    expect(parseJUnit(xml)).toHaveLength(1);
  });
});
