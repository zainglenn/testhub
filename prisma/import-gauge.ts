import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parseGaugeSpec } from "../src/lib/gauge";
import { prisma } from "./script-client";

const SOURCE = process.env.GAUGE_SOURCE ?? process.argv[2];
const PROJECT_KEY = process.env.GAUGE_PROJECT_KEY ?? "GAUGE";
const PROJECT_NAME = process.env.GAUGE_PROJECT_NAME ?? "Gauge import";
const WORKSPACE_NAME = process.env.GAUGE_WORKSPACE;

if (!SOURCE) {
  console.error(
    "Set GAUGE_SOURCE (or pass a directory arg) to a Gauge project root containing a specs/ folder.",
  );
  process.exit(1);
}

async function findSpecFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "reports" || entry.name === "node_modules") continue;
      files.push(...(await findSpecFiles(full)));
    } else if (entry.name.endsWith(".spec")) {
      files.push(full);
    }
  }
  return files;
}

function suiteNames(relativeFile: string): string[] {
  const parts = relativeFile.split(/[\\/]/);
  parts.pop();
  if (parts[0] === "specs") parts.shift();
  return parts;
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
        description: `Imported from Gauge specs at ${SOURCE}.`,
        createdById: admin?.id ?? null,
      },
    }));

  const specFiles = await findSpecFiles(SOURCE);
  if (specFiles.length === 0) {
    console.log(`No .spec files found under ${SOURCE}.`);
    return;
  }

  let created = 0;
  let updated = 0;

  for (const file of specFiles) {
    const text = await readFile(file, "utf8");
    const spec = parseGaugeSpec(text);
    const relative = path.relative(SOURCE, file);
    const suiteId = await ensureSuite(project.id, suiteNames(relative));

    for (const scenario of spec.scenarios) {
      const externalId = `${relative.replace(/\\/g, "/")}#${scenario.title}`;
      const description =
        scenario.description ?? spec.description ?? null;

      const existing: { id: string } | null = await prisma.testCase.findUnique({
        where: { projectId_externalId: { projectId: project.id, externalId } },
        select: { id: true },
      });

      let testCaseId: string;
      if (existing) {
        testCaseId = existing.id;
        await prisma.testCase.update({
          where: { id: testCaseId },
          data: { title: scenario.title, description, suiteId },
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
            title: scenario.title,
            description,
            priority: "MEDIUM",
            createdById: admin?.id ?? null,
          },
        });
        testCaseId = testCase.id;
        created += 1;
      }

      if (scenario.steps.length > 0) {
        await prisma.testStep.createMany({
          data: scenario.steps.map((action, order) => ({
            testCaseId,
            order,
            action,
          })),
        });
      }

      for (const tag of scenario.tags) {
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
    `Gauge import into "${PROJECT_KEY}": ${created} created, ${updated} updated (${specFiles.length} spec files).`,
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
