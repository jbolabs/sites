/** Helpers for plain CMS text fields: paragraphs, lines, and inline links. */
/** Splits CMS text on blank lines, dropping empty paragraphs. */
export const paragraphs = (text: string | null | undefined): string[] =>
  (text ?? "")
    .split(/\n\s*\n/u)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== "");

/** Splits CMS text into its non-empty lines (addresses, short lists). */
export const lines = (text: string | null | undefined): string[] =>
  (text ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

export type TextPart =
  | { readonly text: string }
  | { readonly text: string; readonly href: string };

/** The next `[label](url)` at or after `from`, found by scanning (no backtracking). */
interface InlineLink {
  readonly start: number;
  readonly end: number;
  readonly label: string;
  readonly href: string;
}

const nextLink = (text: string, from: number): InlineLink | null => {
  let open = text.indexOf("[", from);
  while (open !== -1) {
    const close = text.indexOf("](", open + 1);
    const end = close === -1 ? -1 : text.indexOf(")", close + 2);
    if (close === -1 || end === -1) {
      return null;
    }
    const label = text.slice(open + 1, close);
    const href = text.slice(close + 2, end);
    if (
      label !== "" &&
      !label.includes("[") &&
      href !== "" &&
      !/\s/u.test(href)
    ) {
      return { end: end + 1, href, label, start: open };
    }
    open = text.indexOf("[", open + 1);
  }
  return null;
};

/**
 * Splits plain CMS text on `[label](url)` links, so short text fields (a
 * giving note, say) can carry an email or web link without rich text.
 */
export const textParts = (text: string): TextPart[] => {
  const parts: TextPart[] = [];
  let last = 0;
  for (
    let link = nextLink(text, 0);
    link !== null;
    link = nextLink(text, last)
  ) {
    if (link.start > last) {
      parts.push({ text: text.slice(last, link.start) });
    }
    parts.push({ href: link.href, text: link.label });
    last = link.end;
  }
  if (last < text.length) {
    parts.push({ text: text.slice(last) });
  }
  return parts;
};
