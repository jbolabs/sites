import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { FONT_SIZE_TOKENS, cn } from "./utils.ts";

const css = readFileSync(
  path.join(import.meta.dirname, "../styles/global.css"),
  "utf-8"
);
/** `--text-ui:` but not its `--text-ui--line-height:` companion. */
const SIZE_TOKEN = /--text-(?<name>[a-z0-9]+(?:-[a-z0-9]+)*):/gu;

describe(cn, () => {
  it("keeps a text color next to a site font size", () => {
    expect(cn("text-primary-foreground", "text-ui")).toBe(
      "text-primary-foreground text-ui"
    );
    expect(cn("text-sm", "text-ui")).toBe("text-ui");
  });

  it("knows every font size global.css defines", () => {
    const defined = [...css.matchAll(SIZE_TOKEN)].flatMap((match) =>
      match.groups?.name === undefined ? [] : [match.groups.name]
    );
    expect(defined).toStrictEqual([...FONT_SIZE_TOKENS]);
  });
});
