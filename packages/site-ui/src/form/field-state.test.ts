import { describe, expect, it } from "vitest";

import { fieldState } from "./field-state.ts";

const field = (isTouched: boolean, errors: unknown[]) => ({
  name: "email",
  state: { meta: { errors, isTouched, isValid: errors.length === 0 } },
});

describe(fieldState, () => {
  it("links a touched, failing field to its message", () => {
    const state = fieldState(
      field(true, [{ message: "Enter a valid email address." }]),
      "contact"
    );
    expect(state.isInvalid).toBeTruthy();
    expect(state.control).toStrictEqual({
      "aria-describedby": "contact-email-error",
      "aria-invalid": true,
      id: "contact-email",
    });
    expect(state.errors).toStrictEqual([
      { message: "Enter a valid email address." },
    ]);
  });

  it("stays quiet before the field is touched", () => {
    const state = fieldState(field(false, [{ message: "Required." }]), "book");
    expect(state.isInvalid).toBeFalsy();
    expect(state.control["aria-describedby"]).toBeUndefined();
    expect(state.id).toBe("book-email");
  });
});
