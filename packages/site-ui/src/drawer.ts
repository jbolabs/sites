import { useCallback, useState } from "react";
import type { CSSProperties } from "react";

/**
 * Lets a drawer's height follow its content with a transition. CSS can't
 * animate to `height: auto` on Safari, so the content's own height is
 * measured and set on its wrapper in pixels; `drawer.css` eases the change.
 *
 *   const { measure, style } = useDrawerHeight();
 *   <div className="drawer-body" style={style}><div ref={measure}>…</div></div>
 *
 * Until the first measurement the wrapper keeps its natural height, so the
 * sheet opens at the right size without animating from zero.
 */
const nothingToClean = () => {
  // A detached ref has no observer to stop.
};

export const useDrawerHeight = () => {
  const [height, setHeight] = useState<number | null>(null);
  const measure = useCallback((element: HTMLElement | null) => {
    if (element === null) {
      return nothingToClean;
    }
    const observer = new ResizeObserver(() => {
      setHeight(element.offsetHeight);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);
  const style: CSSProperties | undefined =
    height === null ? undefined : { height };
  return { measure, style };
};
