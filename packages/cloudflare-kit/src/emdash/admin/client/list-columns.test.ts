import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { contentListColumns, fieldText } from "./list-columns.tsx";

describe(fieldText, () => {
  it("reads stored text and numbers", () => {
    expect(fieldText("confirmed")).toBe("confirmed");
    expect(fieldText(45)).toBe("45");
  });

  it("reads nothing from an empty or other value", () => {
    expect(
      ["  ", null, { id: "media" }, "Booked"].map((value) => fieldText(value))
    ).toStrictEqual([undefined, undefined, undefined, "Booked"]);
  });
});

describe(contentListColumns, () => {
  it("makes one column per listed field, in order, for that collection only", () => {
    const columns = contentListColumns({
      appointments: {
        columns: [
          { field: "starts_at", format: "datetime", label: "When" },
          { field: "phone", format: "phone", label: "Phone" },
        ],
      },
      pages: {},
    });
    expect(
      columns.map(({ collections, id, label, order }) => ({
        collections,
        id,
        label,
        order,
      }))
    ).toStrictEqual([
      {
        collections: ["appointments"],
        id: "appointments-starts_at",
        label: "When",
        order: 0,
      },
      {
        collections: ["appointments"],
        id: "appointments-phone",
        label: "Phone",
        order: 1,
      },
    ]);
  });

  it("adds no columns for a site without lists", () => {
    expect(contentListColumns()).toStrictEqual([]);
  });

  it("shows a booking's values and fades the row values it was told to", () => {
    const [when, phone, status] = contentListColumns(
      {
        appointments: {
          columns: [
            { field: "starts_at", format: "datetime", label: "When" },
            { field: "phone", format: "phone", label: "Phone" },
            {
              fade: ["cancelled"],
              field: "state",
              label: "Status",
              labels: { cancelled: "Cancelled", confirmed: "Booked" },
            },
          ],
        },
      },
      "America/Los_Angeles",
      new Date("2026-11-09T16:00:00Z")
    );
    const cell = (
      column: typeof when,
      data: {
        readonly phone?: string;
        readonly starts_at?: string;
        readonly state: string;
      }
    ) =>
      column === undefined
        ? ""
        : renderToStaticMarkup(createElement(column.cell, { item: { data } }));
    const booking = {
      phone: "9495550142",
      starts_at: "2026-11-10T18:00:00.000Z",
      state: "cancelled",
    };
    expect([
      cell(when, booking),
      cell(phone, booking),
      cell(status, booking),
    ]).toStrictEqual([
      '<span data-admin-format="datetime">Tue, Nov 10, 10:00 AM</span>',
      '<span data-admin-format="phone">(949) 555-0142</span>',
      '<span data-admin-fade="">Cancelled</span>',
    ]);
    expect(cell(phone, { state: "confirmed" })).toBe(
      '<span data-admin-format="phone"></span>'
    );
    expect(cell(status, { state: "confirmed" })).toBe("<span>Booked</span>");
  });
});
