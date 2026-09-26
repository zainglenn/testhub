import crypto from "node:crypto";
import { hashPassword } from "../src/lib/password";
import { prisma } from "./script-client";

async function main() {
  const email = process.argv[2] ?? process.env.ADMIN_EMAIL;
  const provided = process.argv[3] ?? process.env.ADMIN_PASSWORD;

  if (!email) {
    console.error("Usage: npm run db:password -- <email> [password]");
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user found with email ${email}.`);
    process.exitCode = 1;
    return;
  }

  const password = provided ?? crypto.randomBytes(18).toString("base64url");

  await prisma.user.update({
    where: { email },
    data: { passwordHash: hashPassword(password), failedLoginCount: 0, lockedUntil: null },
  });
  await prisma.session.deleteMany({ where: { userId: user.id } });

  console.log(`Password updated for ${email} (existing sessions revoked).`);
  if (!provided) {
    console.log(`New password (store it now, it is not shown again): ${password}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
