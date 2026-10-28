import { describe, expect, it } from "vitest";

import { isPublishLabel, listColumnLabel } from "./admin-marks.ts";

/** The Products list as EmDash renders it: checkbox, title, three site columns, status, date, actions. */
const products = {
  date: 6,
  headers: [
    "",
    "Title",
    "Brand",
    "Best for",
    " Show on the home page ",
    "Status",
    "Date",
    "Actions",
  ],
  title: 1,
};

describe(listColumnLabel, () => {
  it("names the site's own columns between the title and the status", () => {
    expect(
      products.headers.map((_, index) => listColumnLabel(products, index))
    ).toStrictEqual([
      undefined,
      undefined,
      "Brand",
      "Best for",
      "Show on the home page",
      undefined,
      undefined,
      undefined,
    ]);
  });

  it("names nothing on a list with no columns of its own", () => {
    const pages = {
      date: 3,
      headers: ["", "Title", "Status", "Date", "Actions"],
      title: 1,
    };
    expect(listColumnLabel(pages, 2)).toBeUndefined();
    expect(listColumnLabel(products, 2)).toBe("Brand");
  });

  it("names nothing when a row has no entry link", () => {
    expect(listColumnLabel({ ...products, title: -1 }, 2)).toBeUndefined();
    expect(listColumnLabel(products, 3)).toBe("Best for");
  });
});

describe(isPublishLabel, () => {
  it("matches EmDash's publish buttons and not unpublish", () => {
    expect(
      ["Publish now", " Publish changes ", "Unpublish Product", "Save"].map(
        isPublishLabel
      )
    ).toStrictEqual([true, true, false, false]);
  });
});
