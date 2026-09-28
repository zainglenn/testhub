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
  addPreconditionStep,
  createPrecondition,
  deletePrecondition,
  deletePreconditionStep,
  updatePrecondition,
} from "@/lib/actions/workspace";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function PreconditionsPage() {
  if (!(await requireAdmin())) redirect("/projects");
  const workspace = await getWorkspace();

  const preconditions = await prisma.precondition.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { name: "asc" },
    include: { steps: { orderBy: { order: "asc" } } },
  });

  const form = (precondition?: { name?: string; description?: string | null }) => (
    <>
      <TextField name="name" label="Name" defaultValue={precondition?.name} required />
      <TextField
        name="description"
        label="Description"
        multiline
        minRows={2}
        defaultValue={precondition?.description ?? ""}
      />
    </>
  );

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
          <Typography variant="h1">Preconditions</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Reusable preconditions (with optional steps) that can be attached to
            test cases.
          </Typography>
        </Box>
        <FormDialog
          action={createPrecondition}
          title="New precondition"
          triggerLabel="New precondition"
          submitLabel="Create precondition"
          successMessage="Precondition created"
        >
          {form()}
        </FormDialog>
      </Stack>

      {preconditions.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              No preconditions yet.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        preconditions.map((precondition) => (
          <Card key={precondition.id}>
            <CardContent>
              <Stack
                direction="row"
                spacing={1}
                sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="h6">{precondition.name}</Typography>
                  {precondition.description ? (
                    <Typography variant="body2" color="text.secondary">
                      {precondition.description}
                    </Typography>
                  ) : null}
                </Box>
                <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                  <FormDialog
                    action={updatePrecondition}
                    hidden={{ id: precondition.id }}
                    title={`Edit ${precondition.name}`}
                    triggerLabel="Edit"
                    triggerVariant="outlined"
                    submitLabel="Save"
                    successMessage="Precondition updated"
                  >
                    {form(precondition)}
                  </FormDialog>
                  <ConfirmButton
                    action={deletePrecondition}
                    hidden={{ id: precondition.id }}
                    title="Delete precondition?"
                    description={`Delete "${precondition.name}" and its steps?`}
                    confirmLabel="Delete"
                    iconOnly
                    ariaLabel={`Delete ${precondition.name}`}
                    icon={<DeleteOutlinedIcon fontSize="small" />}
                  />
                </Stack>
              </Stack>

              {precondition.steps.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No steps yet.
                </Typography>
              ) : (
                <Stack spacing={0.5}>
                  {precondition.steps.map((step, index) => (
                    <Stack
                      key={step.id}
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: "center", justifyContent: "space-between" }}
                    >
                      <Typography variant="body2">
                        <Box component="span" sx={{ fontWeight: 700, mr: 1 }}>
                          {index + 1}
                        </Box>
                        {step.action}
                        {step.expectedResult ? (
                          <Typography
                            component="span"
                            variant="caption"
                            color="text.secondary"
                          >
                            {" "}
                            → {step.expectedResult}
                          </Typography>
                        ) : null}
                      </Typography>
                      <ConfirmButton
                        action={deletePreconditionStep}
                        hidden={{ id: step.id }}
                        title="Delete step?"
                        description="Remove this step from the precondition."
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
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon fontSize="small" />}
                  sx={{ minHeight: 40 }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Add step
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <ActionForm
                    action={addPreconditionStep}
                    hidden={{ preconditionId: precondition.id }}
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
