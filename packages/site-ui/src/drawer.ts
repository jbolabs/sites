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

/**
 * Ref for the drawer's `Backdrop` and `Viewport`. On iOS `drawer.css` makes
 * both absolute (fixed layers stop short of Safari's floating toolbar), so
 * they need the page's scroll offset to land on screen. The scroll lock holds
 * the page still while the sheet is open, so one read at mount is enough.
 *
 *   <Drawer.Backdrop ref={pinDrawerToPage} … />
 *   <Drawer.Viewport ref={pinDrawerToPage} … />
 */
export const pinDrawerToPage = (element: HTMLElement | null) => {
  element?.style.setProperty(
    "--drawer-page-top",
    `${element.ownerDocument.defaultView?.scrollY ?? 0}px`
  );
};
