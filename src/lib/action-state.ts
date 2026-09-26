export type ActionState = {
  ok: boolean;
  error?: string;
};

export const initialActionState: ActionState = { ok: false };
