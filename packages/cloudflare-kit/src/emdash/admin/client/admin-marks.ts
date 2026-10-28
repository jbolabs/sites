/**
 * The phone layout (`mobile.ts`) needs two things EmDash's admin has no hook for:
 * the name of each column on a content list, and which editor button publishes.
 * This marks them with data attributes after each render. Nothing is moved or
 * restyled here, so React keeps owning the DOM, and an EmDash change that drops
 * a mark only drops the phone styling that hangs on it.
 */

/** A content list row, as cells in order: EmDash marks only the date cell. */
export interface ListRow {
  readonly headers: readonly string[];
  /** Index of the cell holding the entry's link. */
  readonly title: number;
  /** Index of EmDash's date cell; its status cell comes just before it. */
  readonly date: number;
}

/**
 * The column name to show beside cell `index`, for the site's own list columns
 * (between the title and EmDash's status); undefined for EmDash's own cells,
 * which read without a name (a checkbox, the title, a status badge, icons).
 */
export const listColumnLabel = (
  row: ListRow,
  index: number
): string | undefined => {
  if (row.title < 0 || index <= row.title || index >= row.date - 1) {
    return undefined;
  }
  const name = row.headers[index]?.trim() ?? "";
  return name === "" ? undefined : name;
};

/** EmDash's publish button reads "Publish now" or "Publish changes"; "Unpublish …" stays out of the bar. */
export const isPublishLabel = (text: string): boolean =>
  /^Publish (?:now|changes)$/u.test(text.trim());

const ENTRY_LINK = ':scope > a[href^="/_emdash/admin/content/"]';

const setMark = (element: Element, name: string, value?: string) => {
  if (value === undefined) {
    element.removeAttribute(name);
  } else if (element.getAttribute(name) !== value) {
    element.setAttribute(name, value);
  }
};

const markLists = () => {
  for (const table of document.querySelectorAll(
    "main table:has(td[data-testid=content-updated])"
  )) {
    const headers = [...table.querySelectorAll("thead th")].map(
      (header) => header.textContent ?? ""
    );
    for (const row of table.querySelectorAll("tbody > tr")) {
      const cells = [...row.children];
      const listRow: ListRow = {
        date: cells.findIndex((cell) =>
          cell.matches("[data-testid=content-updated]")
        ),
        headers,
        title: cells.findIndex(
          (cell) => cell.querySelector(ENTRY_LINK) !== null
        ),
      };
      for (const [index, cell] of cells.entries()) {
        setMark(cell, "data-label", listColumnLabel(listRow, index));
      }
    }
  }
};

const markEditorActions = () => {
  for (const button of document.querySelectorAll("main form fieldset button")) {
    setMark(
      button,
      "data-admin-action",
      isPublishLabel(button.textContent ?? "") ? "publish" : undefined
    );
  }
};

export const installAdminMarks = (): void => {
  let queued = false;
  const mark = () => {
    queued = false;
    markLists();
    markEditorActions();
  };
  // One pass per frame however many nodes a render touches; attribute changes are not observed, so marking never re-triggers itself.
  const observer = new MutationObserver(() => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(mark);
    }
  });
  observer.observe(document.body, {
    characterData: true,
    childList: true,
    subtree: true,
  });
  mark();
};
