import { Option } from "effect";
import { describe, expect, it } from "vitest";

import {
  assertContainerId,
  containerScript,
  googleTagManagerFromEnv,
  noscriptFrameUrl,
} from "./google-tag-manager.ts";

describe(googleTagManagerFromEnv, () => {
  it("loads the bound container", () => {
    expect(
      googleTagManagerFromEnv({ GTM_CONTAINER_ID: "GTM-5CF5JZTT" })
    ).toStrictEqual(Option.some("GTM-5CF5JZTT"));
  });

  it("stays off when the binding is empty, as on every stage but prod", () => {
    expect(googleTagManagerFromEnv({ GTM_CONTAINER_ID: "" })).toStrictEqual(
      Option.none()
    );
    expect(
      googleTagManagerFromEnv({ GTM_CONTAINER_ID: "GTM-ABC1234" })
    ).toStrictEqual(Option.some("GTM-ABC1234"));
  });
});

describe(assertContainerId, () => {
  it("accepts a container ID", () => {
    expect(assertContainerId("GTM-5CF5JZTT")).toBe("GTM-5CF5JZTT");
  });

  it("rejects a GA4 measurement ID pasted in by mistake", () => {
    expect(() => assertContainerId("G-ABCDE12345")).toThrow(
      'Not a Google Tag Manager container ID: "G-ABCDE12345"'
    );
  });
});

describe(containerScript, () => {
  it("loads gtm.js for the container into the dataLayer", () => {
    const script = containerScript("GTM-5CF5JZTT");
    expect(script).toContain(
      "'https://www.googletagmanager.com/gtm.js?id='+i+dl"
    );
    expect(script.slice(-37)).toBe(`'script','dataLayer',"GTM-5CF5JZTT");`);
  });
});

describe(noscriptFrameUrl, () => {
  it("points the fallback frame at the container", () => {
    expect(noscriptFrameUrl("GTM-5CF5JZTT")).toBe(
      "https://www.googletagmanager.com/ns.html?id=GTM-5CF5JZTT"
    );
  });
});
