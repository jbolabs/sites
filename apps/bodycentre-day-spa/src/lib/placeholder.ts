/**
 * Placeholder convention for this mock-up: any CMS text wrapped in
 * `[[double brackets]]` is a fact still to confirm (a rating, the hours, a
 * real review). Pages render those parts highlighted, so nothing unconfirmed
 * can pass for real copy, and replacing the text in the CMS clears it.
 */
export interface TextPart {
  readonly text: string;
  readonly placeholder: boolean;
}

const OPEN = "[[";
const CLOSE = "]]";

/** Splits text into plain and placeholder parts, in order, dropping empty pieces. */
export const textParts = (value: string): readonly TextPart[] => {
  const parts: TextPart[] = [];
  const push = (text: string, placeholder: boolean) => {
    if (text !== "") {
      parts.push({ placeholder, text });
    }
  };
  let rest = value;
  for (;;) {
    const start = rest.indexOf(OPEN);
    const end = start === -1 ? -1 : rest.indexOf(CLOSE, start + OPEN.length);
    if (end === -1) {
      push(rest, false);
      return parts;
    }
    push(rest.slice(0, start), false);
    push(rest.slice(start + OPEN.length, end), true);
    rest = rest.slice(end + CLOSE.length);
  }
};
