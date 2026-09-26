import { prisma } from "./script-client";

async function main() {
  const workspace =
    (await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" } })) ??
    (await prisma.workspace.create({ data: { name: "Default Workspace" } }));

  const result = await prisma.project.updateMany({
    where: { workspaceId: null },
    data: { workspaceId: workspace.id },
  });

  console.log(
    `Assigned ${result.count} project(s) to workspace "${workspace.name}".`,
  );
  await prisma.$disconnect();
}

main();
