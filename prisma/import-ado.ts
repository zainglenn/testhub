import "dotenv/config";
import { parseAdoSteps } from "../src/lib/ado";
import { prisma } from "./script-client";

const ORG = process.env.ADO_ORG ?? "";
const ADO_PROJECT = process.env.ADO_PROJECT ?? "";
const PAT = process.env.ADO_PAT ?? "";
const PROJECT_KEY = process.env.ADO_PROJECT_KEY ?? "ADO";
const PROJECT_NAME = process.env.ADO_PROJECT_NAME ?? "Azure DevOps import";
const WORKSPACE_NAME = process.env.ADO_WORKSPACE;

if (!ORG || !ADO_PROJECT || !PAT) {
  console.error(
    "Set ADO_ORG, ADO_PROJECT and ADO_PAT to import Azure DevOps Test Cases.",
  );
  process.exit(1);
}

const AUTH = `Basic ${Buffer.from(`:${PAT}`).toString("base64")}`;
const FIELDS = [
  "System.Id",
  "System.Title",
  "System.Description",
  "System.AreaPath",
  "System.Tags",
  "Microsoft.VSTS.TCM.Steps",
];

function stripHtml(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text || null;
}

async function adoFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: AUTH,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`ADO ${url} failed (${response.status}): ${(await response.text()).slice(0, 200)}`);
  }
  return (await response.json()) as T;
}

async function ensureSuite(projectId: string, names: string[]) {
  let parentId: string | null = null;
  for (const [index, name] of names.entries()) {
    const existing: { id: string } | null = await prisma.testSuite.findFirst({
      where: { projectId, parentId, name },
    });
    if (existing) {
      parentId = existing.id;
      continue;
    }
    const created: { id: string } = await prisma.testSuite.create({
      data: { projectId, parentId, name, order: index },
    });
    parentId = created.id;
  }
  return parentId;
}

async function main() {
  const admin = await prisma.user.findUnique({
    where: { email: "admin@testhub.dev" },
  });

  const workspace = WORKSPACE_NAME
    ? (await prisma.workspace.findFirst({ where: { name: WORKSPACE_NAME } })) ??
      (await prisma.workspace.create({ data: { name: WORKSPACE_NAME } }))
    : ((await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" } })) ??
      (await prisma.workspace.create({ data: { name: "Default Workspace" } })));

  const project =
    (await prisma.project.findFirst({
      where: { workspaceId: workspace.id, key: PROJECT_KEY },
    })) ??
    (await prisma.project.create({
      data: {
        workspaceId: workspace.id,
        key: PROJECT_KEY,
        name: PROJECT_NAME,
        description: `Imported from Azure DevOps (${ORG}/${ADO_PROJECT}).`,
        createdById: admin?.id ?? null,
      },
    }));

  const base = `https://dev.azure.com/${ORG}`;
  const wiql = await adoFetch<{ workItems?: { id: number }[] }>(
    `${base}/${encodeURIComponent(ADO_PROJECT)}/_apis/wit/wiql?api-version=7.0`,
    {
      method: "POST",
      body: JSON.stringify({
        query:
          "SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = 'Test Case' AND [System.TeamProject] = @project ORDER BY [System.Id]",
      }),
    },
  );

  const ids = (wiql.workItems ?? []).map((item) => item.id);
  if (ids.length === 0) {
    console.log("No Test Case work items found in Azure DevOps.");
    return;
  }

  let created = 0;
  let updated = 0;

  for (let index = 0; index < ids.length; index += 200) {
    const batch = await adoFetch<{
      value?: { id: number; fields?: Record<string, unknown> }[];
    }>(`${base}/_apis/wit/workitemsbatch?api-version=7.0`, {
      method: "POST",
      body: JSON.stringify({ ids: ids.slice(index, index + 200), fields: FIELDS }),
    });

    for (const item of batch.value ?? []) {
      const fields = item.fields ?? {};
      const title = String(fields["System.Title"] ?? "").trim() || `ADO #${item.id}`;
      const description = stripHtml(
        typeof fields["System.Description"] === "string"
          ? (fields["System.Description"] as string)
          : null,
      );
      const areaPath = String(fields["System.AreaPath"] ?? "");
      const areaName = areaPath.split("\\").slice(1); // drop the project segment
      const suiteId = await ensureSuite(project.id, areaName);
      const externalId = `ADO-${item.id}`;
      const steps = parseAdoSteps(
        typeof fields["Microsoft.VSTS.TCM.Steps"] === "string"
          ? (fields["Microsoft.VSTS.TCM.Steps"] as string)
          : null,
      );
      const tags = String(fields["System.Tags"] ?? "")
        .split(";")
        .map((tag) => tag.trim())
        .filter(Boolean);

      const existing: { id: string } | null = await prisma.testCase.findUnique({
        where: { projectId_externalId: { projectId: project.id, externalId } },
        select: { id: true },
      });

      let testCaseId: string;
      if (existing) {
        testCaseId = existing.id;
        await prisma.testCase.update({
          where: { id: testCaseId },
          data: { title, description, suiteId },
        });
        await prisma.testStep.deleteMany({ where: { testCaseId } });
        updated += 1;
      } else {
        const last = await prisma.testCase.aggregate({
          where: { projectId: project.id },
          _max: { number: true },
        });
        const testCase = await prisma.testCase.create({
          data: {
            projectId: project.id,
            suiteId,
            externalId,
            number: (last._max.number ?? 0) + 1,
            title,
            description,
            priority: "MEDIUM",
            createdById: admin?.id ?? null,
          },
        });
        testCaseId = testCase.id;
        created += 1;
      }

      if (steps.length > 0) {
        await prisma.testStep.createMany({
          data: steps.map((step, order) => ({
            testCaseId,
            order,
            action: step.action,
            expectedResult: step.expected,
          })),
        });
      }

      for (const tag of tags) {
        const nameKey = tag.toLowerCase();
        const tagRecord = await prisma.tag.upsert({
          where: { projectId_nameKey: { projectId: project.id, nameKey } },
          create: { projectId: project.id, name: tag, nameKey },
          update: {},
        });
        await prisma.testCase.update({
          where: { id: testCaseId },
          data: { tags: { connect: { id: tagRecord.id } } },
        });
      }
    }
  }

  console.log(
    `Azure DevOps import into "${PROJECT_KEY}": ${created} created, ${updated} updated (${ids.length} test cases).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
