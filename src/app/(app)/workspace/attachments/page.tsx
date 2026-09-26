import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { redirect } from "next/navigation";
import { ConfirmButton } from "@/components/confirm-button";
import { FormDialog } from "@/components/form-dialog";
import {
  deleteAttachment,
  uploadAttachment,
} from "@/lib/actions/attachments";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function AttachmentsPage() {
  if (!(await requireAdmin())) redirect("/projects");
  const workspace = await getWorkspace();

  const attachments = await prisma.attachment.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    include: { uploadedBy: { select: { name: true } } },
  });

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", sm: "center" },
        }}
      >
        <Box>
          <Typography variant="h1">Attachments</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Files stored in the workspace (max 5 MB each).
          </Typography>
        </Box>
        <FormDialog
          action={uploadAttachment}
          title="Upload attachment"
          triggerLabel="Upload"
          submitLabel="Upload"
          successMessage="Attachment uploaded"
        >
          <input type="file" name="file" required />
        </FormDialog>
      </Stack>

      <Card>
        <CardContent>
          {attachments.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No attachments yet.
            </Typography>
          ) : (
            attachments.map((attachment) => (
              <Stack
                key={attachment.id}
                direction="row"
                spacing={2}
                sx={{
                  py: 1.5,
                  borderTop: 1,
                  borderColor: "divider",
                  justifyContent: "space-between",
                  alignItems: "center",
                  "&:first-of-type": { borderTop: 0 },
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <a
                    href={`/api/attachments/${attachment.id}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontWeight: 600 }}
                  >
                    {attachment.filename}
                  </a>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    {formatSize(attachment.size)}
                    {attachment.uploadedBy ? ` · ${attachment.uploadedBy.name}` : ""} ·{" "}
                    {new Date(attachment.createdAt).toLocaleDateString()}
                  </Typography>
                </Box>
                <ConfirmButton
                  action={deleteAttachment}
                  hidden={{ id: attachment.id }}
                  title="Delete attachment?"
                  description={`Delete "${attachment.filename}"?`}
                  confirmLabel="Delete"
                  iconOnly
                  ariaLabel={`Delete ${attachment.filename}`}
                  icon={<DeleteOutlinedIcon fontSize="small" />}
                />
              </Stack>
            ))
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
