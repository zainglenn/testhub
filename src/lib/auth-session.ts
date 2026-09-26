import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, SESSION_TTL_MS, encodeSession } from "@/lib/session";

export async function startSession(user: {
  id: string;
  email: string;
  name: string;
  role: string;
}) {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for");

  const record = await prisma.session.create({
    data: {
      userId: user.id,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      userAgent: headerStore.get("user-agent")?.slice(0, 300) ?? null,
      ip: forwarded ? forwarded.split(",")[0].trim() : null,
    },
  });

  const token = encodeSession({
    sessionId: record.id,
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}
