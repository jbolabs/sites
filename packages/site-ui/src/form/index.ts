/**
 * Form plumbing every site shares (TanStack Form, wired the way shadcn's
 * docs show). The styled pieces (Field, Input, Button, ...) stay vendored in
 * each site's `components/ui`, per shadcn.
 */
export { fieldState } from "./field-state.ts";
export { nextFieldOnEnter } from "./next-field-on-enter.ts";
export { loadTurnstile } from "./turnstile.ts";
export { AUTO_ADVANCE_MS, useAutoAdvance } from "./use-auto-advance.ts";
export { focusFirstInvalid, useSiteForm } from "./use-site-form.ts";
export type { FieldMessages, SiteFormOptions } from "./use-site-form.ts";
export { useTurnstile } from "./use-turnstile.ts";
/** Re-exported so sites read form state without their own TanStack dependency. */
export { useSelector } from "@tanstack/react-form";

/** The submit button's label while a form is on its way (English sites). */
export const SUBMITTING = "Submitting...";
