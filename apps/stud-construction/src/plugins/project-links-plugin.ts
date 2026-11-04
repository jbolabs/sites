/**
 * Checks a project's Instagram links when it is saved, from the admin, the
 * assistant, or the API: each must be an Instagram post, reel, or highlight.
 * A bad link stops the save with a plain message the editor sees, and good
 * ones are stored in one clean form (no share tracking, no account prefix).
 * Field validation can't do this: EmDash ignores patterns on repeater rows.
 */
import { Option, Schema } from "effect";
import type { ContentHookEvent } from "emdash";
import { ContentSaveRejectedError, definePlugin } from "emdash";

import { checkInstagramLinks } from "../lib/instagram.ts";
import {
  PROJECT_LINKS_PLUGIN_ID,
  PROJECT_LINKS_VERSION,
} from "./project-links.ts";

const Rows = Schema.Array(
  Schema.Struct({ url: Schema.optional(Schema.NullOr(Schema.String)) })
);

const beforeSave = async (event: ContentHookEvent) => {
  // Updates can carry only the fields that changed; leave the rest alone.
  if (
    event.collection !== "projects" ||
    !Object.hasOwn(event.content, "instagram")
  ) {
    return event.content;
  }
  const raw = event.content.instagram;
  if (raw === null || raw === undefined) {
    return event.content;
  }
  const rows = Option.getOrUndefined(Schema.decodeUnknownOption(Rows)(raw));
  if (rows === undefined) {
    throw new ContentSaveRejectedError("Instagram links could not be read.");
  }
  const checked = checkInstagramLinks(rows.map((row) => row.url ?? ""));
  if (checked.refused !== undefined) {
    throw new ContentSaveRejectedError(checked.refused);
  }
  return await Promise.resolve({
    ...event.content,
    instagram: checked.urls.map((url) => ({ url })),
  });
};

export const createPlugin = () =>
  definePlugin({
    capabilities: ["content:write"],
    hooks: {
      "content:beforeSave": { errorPolicy: "abort", handler: beforeSave },
    },
    id: PROJECT_LINKS_PLUGIN_ID,
    version: PROJECT_LINKS_VERSION,
  });

export default createPlugin;
