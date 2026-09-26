import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  if (!(await requireAdmin())) redirect("/projects");
  const workspace = await getWorkspace();

  const logs = await prisma.auditLog.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { actor: { select: { name: true, email: true } } },
  });

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h1">Audit log</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          The most recent 100 security-relevant actions.
        </Typography>
      </Box>

      <Card>
        <CardContent>
          {logs.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No activity recorded yet.
            </Typography>
          ) : (
            logs.map((log) => (
              <Stack
                key={log.id}
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{
                  py: 1,
                  borderTop: 1,
                  borderColor: "divider",
                  justifyContent: "space-between",
                  "&:first-of-type": { borderTop: 0 },
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {log.action}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {log.actor?.name ?? "System"}
                    {log.entityType ? ` · ${log.entityType}` : ""}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                  {new Date(log.createdAt).toLocaleString()}
                </Typography>
              </Stack>
            ))
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
