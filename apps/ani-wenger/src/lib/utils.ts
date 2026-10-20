import { clsx } from "clsx";
import type { ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Font sizes this site adds in `src/styles/global.css` (`--text-*`).
 * tailwind-merge only knows Tailwind's own scale; without these it reads
 * `text-ui` as a color and drops a button's `text-primary-foreground`.
 * `utils.test.ts` fails when global.css gains a size missing here.
 */
export const FONT_SIZE_TOKENS = ["ui", "step", "display-sm"] as const;

const twMerge = extendTailwindMerge({
  extend: { theme: { text: [...FONT_SIZE_TOKENS] } },
});

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
