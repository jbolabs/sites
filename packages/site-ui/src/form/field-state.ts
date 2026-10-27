/** The slice of a TanStack field this needs, so any field type fits. */
interface FieldLike {
  readonly name: string | number | symbol;
  readonly state: {
    readonly meta: {
      readonly isTouched: boolean;
      readonly isValid: boolean;
      readonly errors: readonly unknown[];
    };
  };
}

const hasMessage = (error: unknown): error is { message: string } =>
  typeof error === "object" &&
  error !== null &&
  "message" in error &&
  typeof error.message === "string";

/**
 * shadcn's TanStack Form pattern (`isTouched && !isValid`) plus the ids that
 * tie a field to its message: spread `control` on the input and pass
 * `errors`/`errorId` to `FieldError`.
 */
export const fieldState = (field: FieldLike, idPrefix: string) => {
  const id = `${idPrefix}-${String(field.name)}`;
  const errorId = `${id}-error`;
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
  const errors = field.state.meta.errors.filter(hasMessage);
  return {
    control: {
      "aria-describedby": isInvalid ? errorId : undefined,
      "aria-invalid": isInvalid,
      id,
    },
    errorId,
    errors,
    id,
    isInvalid,
  };
};
