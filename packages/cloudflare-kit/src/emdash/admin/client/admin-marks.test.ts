import { describe, expect, it } from "vitest";

import { listMarks } from "./admin-marks.ts";

const sorted = (text: string) => ({ sortable: true, text });
const plain = (text: string) => ({ sortable: false, text });

/** The Products list as EmDash renders it: checkbox, title, three site columns, status, date, actions. */
const products = [
  plain(""),
  sorted("Title"),
  plain("Brand"),
  plain("Best for"),
  plain(" Show on the home page "),
  sorted("Status"),
  sorted("Date"),
  plain("Actions"),
];

describe(listMarks, () => {
  it("names the site's own columns and finds the status", () => {
    const marks = listMarks(products, 1);
    expect([...marks.labels]).toStrictEqual([
      [2, "Brand"],
      [3, "Best for"],
      [4, "Show on the home page"],
    ]);
    expect(marks.status).toBe(5);
  });

  it("finds the status ahead of the locale on a translated site", () => {
    const pages = [
      plain(""),
      sorted("Title"),
      plain("Summary"),
      sorted("Status"),
      sorted("Locale"),
      sorted("Date"),
      plain("Actions"),
    ];
    const marks = listMarks(pages, 1);
    expect(marks.status).toBe(3);
    expect([...marks.labels]).toStrictEqual([[2, "Summary"]]);
  });

  it("names a plugin column after the date but not the row's icons", () => {
    const withPlugin = [
      sorted("Title"),
      sorted("Status"),
      sorted("Date"),
      plain("Views"),
      plain("Actions"),
    ];
    expect([...listMarks(withPlugin, 0).labels]).toStrictEqual([[3, "Views"]]);
  });

  it("marks nothing when a row has no entry link", () => {
    const marks = listMarks(products, -1);
    expect(marks.labels.size).toBe(0);
    expect(marks.status).toBeUndefined();
    expect(listMarks(products, 1).labels.get(2)).toBe("Brand");
  });
});
