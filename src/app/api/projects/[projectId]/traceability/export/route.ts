import { getSession } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { prisma } from "@/lib/prisma";
import { buildTraceability } from "@/lib/traceability";
import { projectInActiveWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/projects/[projectId]/traceability/export">,
) {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { projectId } = await ctx.params;
  if (!(await projectInActiveWorkspace(projectId))) {
    return new Response("Not found", { status: 404 });
  }

  const traceability = await buildTraceability(projectId);
  if (!traceability) {
    return new Response("Not found", { status: 404 });
  }
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { key: true },
  });

  const rows: string[][] = [
    [
      "Requirement",
      "Summary",
      "Status",
      "Type",
      "URL",
      "Tests",
      "Passed",
      "Failed",
      "Untested",
      "Coverage %",
      "Bugs",
    ],
  ];

  for (const requirement of traceability.requirements) {
    rows.push([
      requirement.key,
      requirement.summary ?? "",
      requirement.status ?? "",
      requirement.issueType ?? "",
      requirement.url ?? "",
      String(requirement.tests.length),
      String(requirement.passed),
      String(requirement.failed),
      String(requirement.untested),
      String(requirement.coverage),
      requirement.bugs.join("; "),
    ]);
  }

  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${project?.key ?? "project"}-traceability.csv"`,
    },
  });
}
