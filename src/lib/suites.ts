export type SuiteRecord = {
  id: string;
  name: string;
  parentId: string | null;
};

export type SuiteNode = SuiteRecord & { children: SuiteNode[] };

export function buildSuiteTree(suites: SuiteRecord[]): SuiteNode[] {
  const nodes = new Map<string, SuiteNode>();
  for (const suite of suites) {
    nodes.set(suite.id, { ...suite, children: [] });
  }

  const roots: SuiteNode[] = [];
  for (const suite of suites) {
    const node = nodes.get(suite.id)!;
    const parent = suite.parentId ? nodes.get(suite.parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export function flattenSuites(
  nodes: SuiteNode[],
  depth = 0,
): { id: string; label: string }[] {
  return nodes.flatMap((node) => [
    { id: node.id, label: `${"— ".repeat(depth)}${node.name}` },
    ...flattenSuites(node.children, depth + 1),
  ]);
}

export type SuiteTreeNode = {
  id: string;
  name: string;
  count: number;
  children: SuiteTreeNode[];
};

/**
 * Attaches a cumulative case count (the suite's own cases plus every
 * descendant's) to each node, for the repository sidebar.
 */
export function withCumulativeCounts(
  nodes: SuiteNode[],
  directCounts: Map<string, number>,
): SuiteTreeNode[] {
  return nodes.map((node) => {
    const children = withCumulativeCounts(node.children, directCounts);
    const count =
      (directCounts.get(node.id) ?? 0) +
      children.reduce((sum, child) => sum + child.count, 0);
    return { id: node.id, name: node.name, count, children };
  });
}
