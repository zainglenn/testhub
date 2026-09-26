import { describe, expect, it } from "vitest";
import { buildSuiteTree, flattenSuites } from "./suites";

describe("buildSuiteTree", () => {
  it("nests children under their parent", () => {
    const tree = buildSuiteTree([
      { id: "1", name: "Root", parentId: null },
      { id: "2", name: "Child", parentId: "1" },
      { id: "3", name: "Root 2", parentId: null },
    ]);

    expect(tree).toHaveLength(2);
    expect(tree[0].children.map((node) => node.id)).toEqual(["2"]);
  });

  it("treats orphans as roots", () => {
    const tree = buildSuiteTree([
      { id: "2", name: "Orphan", parentId: "missing" },
    ]);
    expect(tree.map((node) => node.id)).toEqual(["2"]);
  });
});

describe("flattenSuites", () => {
  it("flattens with depth prefixes", () => {
    const tree = buildSuiteTree([
      { id: "1", name: "Root", parentId: null },
      { id: "2", name: "Child", parentId: "1" },
    ]);

    expect(flattenSuites(tree)).toEqual([
      { id: "1", label: "Root" },
      { id: "2", label: "— Child" },
    ]);
  });
});
