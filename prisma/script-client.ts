import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Point it at your Postgres database (see .env.example).",
  );
}

export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
