import { getSession } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { prisma } from "@/lib/prisma";
import { projectInActiveWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/projects/[projectId]/runs/[runId]/export">,
) {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { projectId, runId } = await ctx.params;
  if (!(await projectInActiveWorkspace(projectId))) {
    return new Response("Not found", { status: 404 });
  }

  const run = await prisma.testRun.findFirst({
    where: { id: runId, projectId },
    include: {
      project: true,
      items: {
        orderBy: { order: "asc" },
        include: {
          testCase: { include: { suite: true } },
        },
      },
      executions: {
        include: {
          executedBy: { select: { name: true } },
          stepResults: { select: { order: true, status: true } },
        },
      },
    },
  });
  if (!run) {
    return new Response("Not found", { status: 404 });
  }

  const executionByCase = new Map(
    run.executions.map((execution) => [execution.testCaseId, execution]),
  );
  const format = new URL(request.url).searchParams.get("format") ?? "csv";
  const safeName = run.name.replace(/[^A-Za-z0-9-_]+/g, "-").slice(0, 60);

  if (format === "junit") {
    const failures = run.executions.filter((e) => e.status === "FAIL").length;
    const skipped = run.executions.filter(
      (e) => e.status === "SKIPPED",
    ).length;

    const cases = run.items.map((item) => {
      const execution = executionByCase.get(item.testCaseId);
      const classname = item.testCase.suite?.name ?? run.project.name;
      const name = `${run.project.key}-${item.testCase.number} ${item.testCase.title}`;
      const attrs = `classname="${xmlEscape(classname)}" name="${xmlEscape(name)}"`;
      if (!execution) {
        return `    <testcase ${attrs}>\n      <skipped message="Not executed"/>\n    </testcase>`;
      }
      if (execution.status === "FAIL") {
        return `    <testcase ${attrs}>\n      <failure message="${xmlEscape(
          execution.comment ?? "Failed",
        )}">${xmlEscape(execution.comment ?? "")}</failure>\n    </testcase>`;
      }
      if (execution.status === "BLOCKED") {
        return `    <testcase ${attrs}>\n      <error message="${xmlEscape(
          execution.comment ?? "Blocked",
        )}"/>\n    </testcase>`;
      }
      if (execution.status === "SKIPPED") {
        return `    <testcase ${attrs}>\n      <skipped/>\n    </testcase>`;
      }
      return `    <testcase ${attrs}/>`;
    });

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<testsuites tests="${run.items.length}" failures="${failures}" skipped="${skipped}">`,
      `  <testsuite name="${xmlEscape(run.name)}" tests="${run.items.length}" failures="${failures}" skipped="${skipped}">`,
      ...cases,
      "  </testsuite>",
      "</testsuites>",
      "",
    ].join("\n");

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${run.project.key}-${safeName}.xml"`,
      },
    });
  }

  const rows: string[][] = [
    [
      "Key",
      "Title",
      "Suite",
      "Status",
      "Dataset",
      "Comment",
      "Executed by",
      "Executed at",
      "Steps",
    ],
  ];

  for (const item of run.items) {
    const execution = executionByCase.get(item.testCaseId);
    const stepResults = execution?.stepResults ?? [];
    rows.push([
      `${run.project.key}-${item.testCase.number}`,
      item.testCase.title,
      item.testCase.suite?.name ?? "",
      execution?.status ?? "UNTESTED",
      execution?.dataset ?? "",
      execution?.comment ?? "",
      execution?.executedBy?.name ?? "",
      execution ? execution.executedAt.toISOString() : "",
      [...stepResults]
        .sort((a, b) => a.order - b.order)
        .map((step, index) => `${index + 1}: ${step.status}`)
        .join("; "),
    ]);
  }

  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${run.project.key}-${safeName}.csv"`,
    },
  });
}
