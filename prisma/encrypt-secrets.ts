import { encryptSecret, isEncrypted } from "../src/lib/secret-box";
import { prisma } from "./script-client";

async function main() {
  const connections = await prisma.jiraConnection.findMany();
  let jiraCount = 0;
  for (const connection of connections) {
    const data: { accessToken?: string; refreshToken?: string } = {};
    if (!isEncrypted(connection.accessToken)) {
      data.accessToken = encryptSecret(connection.accessToken);
    }
    if (connection.refreshToken && !isEncrypted(connection.refreshToken)) {
      data.refreshToken = encryptSecret(connection.refreshToken);
    }
    if (Object.keys(data).length > 0) {
      await prisma.jiraConnection.update({ where: { id: connection.id }, data });
      jiraCount++;
    }
  }

  const ssoConfigs = await prisma.ssoConfig.findMany();
  let ssoCount = 0;
  for (const config of ssoConfigs) {
    if (config.clientSecret && !isEncrypted(config.clientSecret)) {
      await prisma.ssoConfig.update({
        where: { workspaceId: config.workspaceId },
        data: { clientSecret: encryptSecret(config.clientSecret) },
      });
      ssoCount++;
    }
  }

  console.log(
    `Encrypted ${jiraCount} Jira connection(s) and ${ssoCount} SSO config(s).`,
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
