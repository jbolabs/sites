/**
 * The in-progress application, kept on this device so a closed dialog
 * resumes where it left off. Stored as URL-encoded text: every answer is a
 * string, so reading it back needs no shape checks. Consent is never kept
 * (the visitor ticks it again each time), and neither is the date of birth,
 * which shouldn't sit in a shared browser's storage.
 */
import { EMPTY_ANSWERS, STEP_KEYS } from "@/lib/application-rules";
import type { ApplicationAnswers, StepKey } from "@/lib/application-rules";

const DRAFT_KEY = "equityfast.application";
const STEP_PARAM = "step";

export interface Draft {
  readonly answers: ApplicationAnswers;
  readonly step: StepKey;
}

type TextField = Exclude<keyof ApplicationAnswers, "consent">;

const TEXT_FIELDS = Object.keys(EMPTY_ANSWERS).filter(
  (key): key is TextField => key !== "consent" && key !== "birthDate"
);

const storage = (): Storage | undefined => {
  try {
    return window.localStorage;
  } catch {
    // Storage disabled (private mode, policy): the form works without resuming.
    return undefined;
  }
};

export const readDraft = (): Draft => {
  const params = new URLSearchParams(storage()?.getItem(DRAFT_KEY) ?? "");
  const answers = { ...EMPTY_ANSWERS };
  for (const field of TEXT_FIELDS) {
    // A blank answer falls back to the default too (other income starts at $0).
    const saved = params.get(field);
    answers[field] =
      saved === null || saved === "" ? EMPTY_ANSWERS[field] : saved;
  }
  const step =
    STEP_KEYS.find((key) => key === params.get(STEP_PARAM)) ?? "amount";
  return { answers, step };
};

export const writeDraft = ({ answers, step }: Draft): void => {
  const params = new URLSearchParams({ [STEP_PARAM]: step });
  for (const field of TEXT_FIELDS) {
    params.set(field, answers[field]);
  }
  try {
    storage()?.setItem(DRAFT_KEY, params.toString());
  } catch {
    // Quota exceeded: losing the draft is harmless.
  }
};

export const clearDraft = (): void => {
  storage()?.removeItem(DRAFT_KEY);
};
