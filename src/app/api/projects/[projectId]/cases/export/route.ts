import { getSession } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/projects/[projectId]/cases/export">,
) {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { projectId } = await ctx.params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      suites: true,
      testCases: {
        orderBy: { number: "asc" },
        include: {
          suite: true,
          steps: { orderBy: { order: "asc" } },
          tags: { orderBy: { name: "asc" } },
        },
      },
    },
  });

  if (!project) {
    return new Response("Not found", { status: 404 });
  }

  const suiteById = new Map(project.suites.map((suite) => [suite.id, suite]));
  const suitePath = (suiteId: string | null): string => {
    const names: string[] = [];
    let current = suiteId ? suiteById.get(suiteId) : undefined;
    while (current) {
      names.unshift(current.name);
      current = current.parentId
        ? suiteById.get(current.parentId)
        : undefined;
    }
    return names.join(" / ");
  };

  const rows: string[][] = [
    [
      "Title",
      "Suite",
      "Priority",
      "Status",
      "Preconditions",
      "Description",
      "Tags",
      "Steps",
    ],
  ];

  for (const testCase of project.testCases) {
    rows.push([
      testCase.title,
      suitePath(testCase.suiteId),
      testCase.priority,
      testCase.status,
      testCase.preconditions ?? "",
      testCase.description ?? "",
      testCase.tags.map((tag) => tag.name).join("; "),
      testCase.steps
        .map((step) =>
          step.expectedResult
            ? `${step.action} => ${step.expectedResult}`
            : step.action,
        )
        .join(" | "),
    ]);
  }

  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${project.key}-cases.csv"`,
    },
  });
}
