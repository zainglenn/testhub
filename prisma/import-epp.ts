import { readFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { prisma } from "./script-client";

const positionalSource = process.argv
  .slice(2)
  .find((arg) => !arg.startsWith("--"));
const SOURCE =
  process.env.EPP_SOURCE ??
  positionalSource ??
  "C:\\dev\\endpoint-epp-autmation-locust-scripts\\epp-setup-test";

const PROJECT_KEY = "EPP";
const RESET = process.argv.includes("--reset");

type Scenario = {
  title: string;
  tags: string[];
  description: string | null;
  steps: string[];
};

type Spec = {
  title: string;
  description: string | null;
  scenarios: Scenario[];
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function parseSpec(text: string): Spec {
  const lines = text.split(/\r?\n/);
  const spec: Spec = { title: "", description: null, scenarios: [] };
  const specDescription: string[] = [];

  let scenario: Scenario | null = null;
  const scenarioDescription: string[] = [];

  const flush = () => {
    if (!scenario) return;
    scenario.description = scenarioDescription.join("\n").trim() || null;
    spec.scenarios.push(scenario);
    scenario = null;
    scenarioDescription.length = 0;
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");

    if (line.startsWith("# ")) {
      spec.title = line.slice(2).trim();
      continue;
    }
    if (line.startsWith("## ")) {
      flush();
      scenario = {
        title: line.slice(3).trim(),
        tags: [],
        description: null,
        steps: [],
      };
      continue;
    }
    if (!scenario) {
      if (line.trim()) specDescription.push(line.trim());
      continue;
    }
    if (/^\s*tags:/.test(line)) {
      scenario.tags.push(
        ...line
          .replace(/^\s*tags:/, "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      );
      continue;
    }
    if (line.startsWith("* ")) {
      scenario.steps.push(line.slice(2).trim());
      continue;
    }
    if (!line.trim()) continue;
    if (line.trimStart().startsWith("|")) continue;
    if (scenario.steps.length === 0) scenarioDescription.push(line.trim());
  }
  flush();

  spec.description = specDescription.join(" ").trim() || null;
  return spec;
}

const SPEC_MAP: { file: string; parent: string; suite: string }[] = [
  { file: "ediscovery_e2e.spec", parent: "eDiscovery", suite: "End-to-End" },
  { file: "ediscovery_server.spec", parent: "eDiscovery", suite: "Server UI" },
  { file: "otp_requests_server.spec", parent: "OTP Requests", suite: "Server UI" },
  { file: "otp_requests_e2e.spec", parent: "OTP Requests", suite: "Agent E2E" },
  { file: "otp_requests_api.spec", parent: "OTP Requests", suite: "REST API" },
  { file: "epp_setup.spec", parent: "Setup", suite: "Server Setup" },
];

async function loadSummaries(): Promise<Map<string, string>> {
  const summaries = new Map<string, string>();
  try {
    const raw = await readFile(
      path.join(SOURCE, "specs", "meta", "jira-sprints.yaml"),
      "utf8",
    );
    const meta = YAML.parse(raw) as Record<string, unknown>;
    for (const group of [
      "epics",
      "stories",
      "detected_bugs",
      "new_tickets",
      "client_stories",
    ]) {
      const bucket = meta?.[group];
      if (!bucket || typeof bucket !== "object") continue;
      for (const [key, value] of Object.entries(bucket as Record<string, unknown>)) {
        if (value && typeof value === "object" && "title" in value) {
          summaries.set(key, String((value as { title: unknown }).title));
        }
      }
    }
  } catch {
    console.warn("No Jira metadata found; links will have no summary.");
  }
  return summaries;
}

async function main() {
  console.log(`Source: ${SOURCE}`);

  const admin = await prisma.user.findUnique({
    where: { email: "admin@testhub.dev" },
  });

  const workspace =
    (await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" } })) ??
    (await prisma.workspace.create({ data: { name: "Default Workspace" } }));
  const summaries = await loadSummaries();

  await prisma.project.deleteMany({ where: { key: "SHOP" } });

  if (RESET) {
    await prisma.project.deleteMany({ where: { key: PROJECT_KEY } });
    console.log("Reset: removed the existing EPP project.");
  }

  const project =
    (await prisma.project.findFirst({ where: { key: PROJECT_KEY } })) ??
    (await prisma.project.create({
      data: {
        key: PROJECT_KEY,
        name: "Endpoint Protection Platform",
        description:
          "Imported from the epp-setup-test Gauge suite (eDiscovery, OTP Requests, server setup).",
        workspaceId: workspace.id,
        createdById: admin?.id ?? null,
      },
    }));

  await prisma.project.updateMany({
    where: { id: project.id, workspaceId: null },
    data: { workspaceId: workspace.id },
  });

  const parentIdByName = new Map<string, string>();
  const childIdByParent = new Map<string, string>();
  for (const suite of await prisma.testSuite.findMany({
    where: { projectId: project.id },
    select: { id: true, name: true, parentId: true },
  })) {
    if (suite.parentId) {
      childIdByParent.set(`${suite.parentId}:${suite.name}`, suite.id);
    } else {
      parentIdByName.set(suite.name, suite.id);
    }
  }

  const maxNumber = await prisma.testCase.aggregate({
    where: { projectId: project.id },
    _max: { number: true },
  });
  let nextNumber = maxNumber._max.number ?? 0;

  let created = 0;
  let updated = 0;
  let stepCount = 0;
  let linkCount = 0;

  for (const entry of SPEC_MAP) {
    const text = await readFile(path.join(SOURCE, "specs", entry.file), "utf8");
    const spec = parseSpec(text);

    let parentId = parentIdByName.get(entry.parent);
    if (!parentId) {
      const parent = await prisma.testSuite.create({
        data: {
          projectId: project.id,
          name: entry.parent,
          order: parentIdByName.size,
        },
      });
      parentId = parent.id;
      parentIdByName.set(entry.parent, parentId);
    }

    const childKey = `${parentId}:${entry.suite}`;
    let suiteId = childIdByParent.get(childKey);
    if (!suiteId) {
      const child = await prisma.testSuite.create({
        data: {
          projectId: project.id,
          parentId,
          name: entry.suite,
          description: spec.description,
          order: childIdByParent.size,
        },
      });
      suiteId = child.id;
      childIdByParent.set(childKey, suiteId);
    } else {
      await prisma.testSuite.update({
        where: { id: suiteId },
        data: { description: spec.description },
      });
    }

    for (const scenario of spec.scenarios) {
      const externalId = `${entry.file}#${slugify(scenario.title)}`;
      const isBug = scenario.tags.includes("bug");
      const isPending = scenario.tags.includes("pending");

      const fields = {
        title: scenario.title,
        description: scenario.description,
        priority: isBug ? "HIGH" : "MEDIUM",
        status: isPending ? "DRAFT" : "ACTIVE",
        suiteId,
      };

      const existing = await prisma.testCase.findUnique({
        where: {
          projectId_externalId: { projectId: project.id, externalId },
        },
        select: { id: true },
      });

      let testCaseId: string;
      if (existing) {
        await prisma.testCase.update({ where: { id: existing.id }, data: fields });
        testCaseId = existing.id;
        updated += 1;
      } else {
        nextNumber += 1;
        const createdCase = await prisma.testCase.create({
          data: {
            projectId: project.id,
            number: nextNumber,
            externalId,
            createdById: admin?.id ?? null,
            ...fields,
          },
        });
        testCaseId = createdCase.id;
        created += 1;
      }

      await prisma.testStep.deleteMany({ where: { testCaseId } });
      if (scenario.steps.length > 0) {
        await prisma.testStep.createMany({
          data: scenario.steps.map((action, index) => ({
            testCaseId,
            action,
            order: index,
          })),
        });
        stepCount += scenario.steps.length;
      }

      const tagNames = new Set<string>([...scenario.tags, "automated"]);
      for (const name of tagNames) {
        const tag = await prisma.tag.upsert({
          where: {
            projectId_nameKey: {
              projectId: project.id,
              nameKey: name.toLowerCase(),
            },
          },
          create: { projectId: project.id, name, nameKey: name.toLowerCase() },
          update: {},
        });
        await prisma.testCase.update({
          where: { id: testCaseId },
          data: { tags: { connect: { id: tag.id } } },
        });
      }

      for (const tag of scenario.tags) {
        if (/^EPP-\d+$/.test(tag)) {
          await prisma.jiraIssueLink.upsert({
            where: { testCaseId_issueKey: { testCaseId, issueKey: tag } },
            create: {
              testCaseId,
              issueKey: tag,
              projectKey: PROJECT_KEY,
              summary: summaries.get(tag) ?? null,
              url: `https://netwrix.atlassian.net/browse/${tag}`,
            },
            update: {
              summary: summaries.get(tag) ?? null,
              url: `https://netwrix.atlassian.net/browse/${tag}`,
            },
          });
          linkCount += 1;
        }
      }
    }
    console.log(`${entry.file}: ${spec.scenarios.length} scenarios`);
  }

  console.log(
    `Synced project ${PROJECT_KEY}: ${created} created, ${updated} updated, ${stepCount} steps, ${linkCount} links.`,
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
