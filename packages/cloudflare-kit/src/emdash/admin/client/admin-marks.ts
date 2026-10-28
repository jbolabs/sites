/**
 * The phone layout (`mobile.ts`) needs two things on a content list that EmDash's
 * admin has no hook for: the name of each column, and which cell holds the status.
 * This marks them with data attributes after each render. Nothing is moved or
 * restyled here, so React keeps owning the DOM, and an EmDash change that drops
 * a mark only drops the phone styling that hangs on it.
 */

/**
 * A content list's header row. EmDash renders its own columns (title, status,
 * locale on translated sites, date) as sortable headers and the site's list
 * columns and plugin columns as plain ones; the last header is the row's icon
 * buttons. The locale badge needs no name: it sits beside the status.
 */
export interface ListHeader {
  readonly text: string;
  readonly sortable: boolean;
}

export interface ListMarks {
  /** Column names to show beside cells, by cell index. */
  readonly labels: ReadonlyMap<number, string>;
  /** EmDash's status column, the first sortable one after the title. */
  readonly status: number | undefined;
}

/** Which cells of a content list row get a name, and which one holds the status badge. */
export const listMarks = (
  headers: readonly ListHeader[],
  title: number
): ListMarks => {
  const labels = new Map<number, string>();
  let status: number | undefined;
  if (title < 0) {
    return { labels, status };
  }
  for (const [index, header] of headers.entries()) {
    const text = header.text.trim();
    if (index <= title || index === headers.length - 1) {
      continue;
    }
    if (header.sortable) {
      status ??= index;
    } else if (text !== "") {
      labels.set(index, text);
    }
  }
  return { labels, status };
};

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
    const headers = [...table.querySelectorAll("thead th")].map((header) => ({
      sortable: header.hasAttribute("aria-sort"),
      text: header.textContent ?? "",
    }));
    for (const row of table.querySelectorAll("tbody > tr")) {
      const cells = [...row.children];
      const { labels, status } = listMarks(
        headers,
        cells.findIndex((cell) => cell.querySelector(ENTRY_LINK) !== null)
      );
      for (const [index, cell] of cells.entries()) {
        setMark(cell, "data-label", labels.get(index));
        setMark(
          cell,
          "data-admin-cell",
          index === status ? "status" : undefined
        );
      }
    }
  }
};

export const installAdminMarks = (): void => {
  let queued = false;
  const mark = () => {
    queued = false;
    markLists();
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
