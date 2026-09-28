import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isStorageConfigured, downloadObject } from "@/lib/supabase-storage";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/evidence/[id]">,
) {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await ctx.params;
  const evidence = await prisma.evidence.findUnique({ where: { id } });
  if (!evidence) {
    return new Response("Not found", { status: 404 });
  }

  const workspace = await getWorkspace();
  if (evidence.workspaceId !== workspace.id) {
    return new Response("Not found", { status: 404 });
  }

  if (!isStorageConfigured()) {
    return new Response("Storage not configured", { status: 503 });
  }

  const object = await downloadObject(evidence.storageKey);
  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(object.data, {
    headers: {
      "Content-Type":
        object.contentType ?? evidence.mime ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${evidence.filename}"`,
    },
  });
}
