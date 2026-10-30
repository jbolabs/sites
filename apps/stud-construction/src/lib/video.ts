const YOUTUBE_ID = /^[\w-]{11}$/u;
const EMBED_PATH = /^\/(?:embed|shorts|live)\/(?<id>[^/]+)/u;

const candidateId = (url: URL): string | undefined => {
  const host = url.hostname.replace(/^(?:www|m)\./u, "");
  if (host === "youtu.be") {
    return url.pathname.slice(1);
  }
  if (host !== "youtube.com" && host !== "youtube-nocookie.com") {
    return undefined;
  }
  return url.searchParams.get("v") ?? EMBED_PATH.exec(url.pathname)?.groups?.id;
};

/**
 * The video id from any common YouTube link (watch, youtu.be, shorts, embed),
 * or `undefined` for anything else, so editors can paste whatever URL they have.
 */
export const youTubeId = (url: string): string | undefined => {
  if (!URL.canParse(url)) {
    return undefined;
  }
  const id = candidateId(new URL(url));
  return id !== undefined && YOUTUBE_ID.test(id) ? id : undefined;
};
