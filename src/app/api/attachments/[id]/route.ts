import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { downloadObject } from "@/lib/supabase-storage";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/attachments/[id]">,
) {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await ctx.params;
  const attachment = await prisma.attachment.findUnique({ where: { id } });
  if (!attachment) {
    return new Response("Not found", { status: 404 });
  }

  const object = await downloadObject(attachment.storageKey);
  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(object.data, {
    headers: {
      "Content-Type":
        object.contentType ?? attachment.mime ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${attachment.filename}"`,
    },
  });
}
