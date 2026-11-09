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
});
