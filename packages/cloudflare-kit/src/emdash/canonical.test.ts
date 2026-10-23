import { describe, expect, it } from "vitest";

import { canonicalRedirect } from "./canonical.ts";

const ORIGIN = "https://example.com";
const location = (url: string, origin = ORIGIN) =>
  canonicalRedirect(new Request(url), origin)?.headers.get("location");

describe(canonicalRedirect, () => {
  it("sends www and plain HTTP to the HTTPS apex, keeping path and query", () => {
    expect(location("https://www.example.com/es/apply?ref=ad")).toBe(
      "https://example.com/es/apply?ref=ad"
    );
    expect(location("http://example.com/contact")).toBe(
      "https://example.com/contact"
    );
    expect(location("http://www.example.com/")).toBe("https://example.com/");
    expect(
      canonicalRedirect(new Request("http://example.com/"), ORIGIN)?.status
    ).toBe(301);
  });

  it("serves the canonical origin, other hosts, and local dev directly", () => {
    expect(location("https://example.com/contact")).toBeUndefined();
    expect(
      location("https://abc123-example-pr-4.acme.workers.dev/")
    ).toBeUndefined();
    expect(
      location("http://localhost:4551/", "http://localhost:4551")
    ).toBeUndefined();
    expect(location("http://www.example.com/x")).toBe("https://example.com/x");
  });
});
