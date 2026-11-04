import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

/**
 * Eases its height to fit what's inside, so the centered dialog grows and
 * shrinks between questions (and as inline errors appear) instead of jumping.
 * Height is the one layout property worth animating here: the dialog is
 * centered, so nothing else can make its edges travel. Measured with a
 * ResizeObserver because `auto` can't be transitioned in every browser.
 * The transition lives in `global.css` (`.auto-height`).
 *
 * Only `ResponsiveDialogContent` uses it, on the dialog half: the drawer
 * already eases its own height (`useDrawerHeight`), and a second animator
 * inside it makes the sheet resize in two steps.
 */
const AutoHeight = ({ children }: { readonly children: ReactNode }) => {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>();

  useLayoutEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const size = entry?.borderBoxSize[0]?.blockSize;
      if (size !== undefined) {
        setHeight(size);
      }
    });
    if (inner.current !== null) {
      observer.observe(inner.current);
    }
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      className="auto-height"
      style={
        height === undefined ? undefined : { "--auto-height": `${height}px` }
      }
    >
      <div ref={inner}>{children}</div>
    </div>
  );
};

export default AutoHeight;
