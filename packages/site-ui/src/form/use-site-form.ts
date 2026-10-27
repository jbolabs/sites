import { revalidateLogic, useForm } from "@tanstack/react-form";

/** One message per field that fails; a field left out is valid. */
export type FieldMessages<Values> = Partial<Record<keyof Values, string>>;

export interface SiteFormOptions<Values> {
  readonly defaultValues: Values;
  /**
   * Every rule the server applies, as plain functions (islands run no Effect).
   * Return a message for each failing field.
   */
  readonly validate: (values: Values) => FieldMessages<Values>;
  /**
   * Runs once every rule passes. `restart` keeps the values but forgets the
   * submit, so the next step of a multi-step form starts quiet again.
   */
  readonly onSubmit: (
    values: Values,
    helpers: { readonly restart: () => void }
  ) => Promise<void> | void;
  /** The `<form id>`, so a failed submit can focus its first invalid field. */
  readonly formId: string;
}

/**
 * Focuses the first field marked invalid, a frame after the errors render, so
 * a screen reader reads the field with its message and a phone scrolls to it.
 */
export const focusFirstInvalid = (formId: string): void => {
  requestAnimationFrame(() => {
    document
      .querySelector(`#${CSS.escape(formId)}`)
      ?.querySelector<HTMLElement>('[aria-invalid="true"]')
      ?.focus();
  });
};

/**
 * TanStack Form, set up the way every site's forms behave: nothing is flagged
 * while the visitor first fills it in, the submit button is always enabled,
 * a submit checks every rule and shows each message on its field, and from
 * then on each edit re-checks so messages clear as soon as they are fixed.
 * Render fields with the shadcn pattern and `fieldState`.
 */
export const useSiteForm = <Values extends object>({
  defaultValues,
  formId,
  onSubmit,
  validate,
}: SiteFormOptions<Values>) =>
  useForm({
    defaultValues,
    onSubmit: async ({ formApi, value }) => {
      await onSubmit(value, {
        restart: () => {
          formApi.reset(formApi.state.values, { keepDefaultValues: true });
        },
      });
    },
    onSubmitInvalid: () => {
      focusFirstInvalid(formId);
    },
    validationLogic: revalidateLogic({
      mode: "submit",
      modeAfterSubmission: "change",
    }),
    validators: {
      onDynamic: ({ value }) => {
        const messages = Object.entries(validate(value)).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string"
        );
        // shadcn's `FieldError` reads `{ message }` objects, as Standard Schema issues are.
        return messages.length === 0
          ? undefined
          : {
              fields: Object.fromEntries(
                messages.map(([name, message]) => [name, { message }])
              ),
            };
      },
    },
  });
