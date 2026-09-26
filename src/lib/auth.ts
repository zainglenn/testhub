import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { SESSION_COOKIE, decodeSession, type Session } from "./session";

export { SESSION_COOKIE, encodeSession, safeNextPath } from "./session";
export type { Session } from "./session";

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const session = decodeSession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;

  const record = await prisma.session.findUnique({
    where: { id: session.sessionId },
    select: { userId: true, expiresAt: true },
  });

  if (
    !record ||
    record.userId !== session.userId ||
    record.expiresAt.getTime() < Date.now()
  ) {
    return null;
  }

  return session;
}
