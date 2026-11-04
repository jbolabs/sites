import type { KeyboardEvent } from "react";

const isField = (
  element: Element
): element is HTMLInputElement | HTMLTextAreaElement =>
  (element instanceof HTMLInputElement && element.type !== "hidden") ||
  element instanceof HTMLTextAreaElement;

/**
 * On a phone keyboard, Return in a single-line field submits the form, even
 * when the key is labeled "next" (`enterKeyHint` only changes the label). Put
 * this on fields marked "next" so Return moves to the following field instead.
 */
export const nextFieldOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
  const field = event.currentTarget;
  if (event.key !== "Enter" || field.form === null) {
    return;
  }
  event.preventDefault();
  const fields = [...field.form.elements].filter(
    (element) => isField(element) && !element.disabled
  );
  const next = fields[fields.indexOf(field) + 1];
  if (next instanceof HTMLElement) {
    next.focus();
  }
};
