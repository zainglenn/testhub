import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { ConfirmButton } from "@/components/confirm-button";
import { FormDialog } from "@/components/form-dialog";
import {
  addSharedStepItem,
  createSharedStep,
  deleteSharedStep,
  deleteSharedStepItem,
} from "@/lib/actions/workspace";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function SharedStepsPage() {
  if (!(await requireAdmin())) redirect("/projects");
  const workspace = await getWorkspace();

  const sharedSteps = await prisma.sharedStep.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { title: "asc" },
    include: { items: { orderBy: { order: "asc" } } },
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
          <Typography variant="h1">Shared steps</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Reusable step groups for the workspace.
          </Typography>
        </Box>
        <FormDialog
          action={createSharedStep}
          title="New shared step"
          triggerLabel="New shared step"
          submitLabel="Create"
          successMessage="Shared step created"
        >
          <TextField name="title" label="Title" required />
        </FormDialog>
      </Stack>

      {sharedSteps.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              No shared steps yet.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        sharedSteps.map((shared) => (
          <Card key={shared.id}>
            <CardContent>
              <Stack
                direction="row"
                spacing={1}
                sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}
              >
                <Typography variant="h6">{shared.title}</Typography>
                <ConfirmButton
                  action={deleteSharedStep}
                  hidden={{ id: shared.id }}
                  title="Delete shared step?"
                  description={`Delete "${shared.title}" and its steps?`}
                  confirmLabel="Delete"
                  iconOnly
                  ariaLabel={`Delete ${shared.title}`}
                  icon={<DeleteOutlinedIcon fontSize="small" />}
                />
              </Stack>

              {shared.items.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No steps yet.
                </Typography>
              ) : (
                <Stack spacing={0.5}>
                  {shared.items.map((item, index) => (
                    <Stack
                      key={item.id}
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: "center", justifyContent: "space-between" }}
                    >
                      <Typography variant="body2">
                        <Box component="span" sx={{ fontWeight: 700, mr: 1 }}>
                          {index + 1}
                        </Box>
                        {item.action}
                        {item.expectedResult ? (
                          <Typography component="span" variant="caption" color="text.secondary">
                            {" "}
                            → {item.expectedResult}
                          </Typography>
                        ) : null}
                      </Typography>
                      <ConfirmButton
                        action={deleteSharedStepItem}
                        hidden={{ id: item.id }}
                        title="Delete step?"
                        description="Remove this step from the shared group."
                        confirmLabel="Delete"
                        color="inherit"
                        iconOnly
                        ariaLabel="Delete step"
                        icon={<DeleteOutlinedIcon sx={{ fontSize: 14 }} />}
                      />
                    </Stack>
                  ))}
                </Stack>
              )}

              <Accordion disableGutters sx={{ mt: 1, "&:before": { display: "none" } }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon fontSize="small" />} sx={{ minHeight: 40 }}>
                  <Typography variant="caption" color="text.secondary">
                    Add step
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <ActionForm
                    action={addSharedStepItem}
                    hidden={{ sharedStepId: shared.id }}
                    submitLabel="Add step"
                    variant="outlined"
                    successMessage="Step added"
                  >
                    <TextField name="action" label="Action" multiline minRows={2} required />
                    <TextField
                      name="expectedResult"
                      label="Expected result"
                      multiline
                      minRows={2}
                    />
                  </ActionForm>
                </AccordionDetails>
              </Accordion>
            </CardContent>
          </Card>
        ))
      )}
    </Stack>
  );
}
