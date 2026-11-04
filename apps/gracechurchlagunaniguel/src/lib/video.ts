/** YouTube links as editors paste them, turned into what the player needs. */
const YOUTUBE_ID = /^[\w-]{11}$/u;
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "youtu.be",
  "youtube-nocookie.com",
]);

/** The video id in a YouTube watch, share, embed, or live link. */
export const youtubeId = (
  url: string | null | undefined
): string | undefined => {
  if (url === null || url === undefined || !URL.canParse(url)) {
    return undefined;
  }
  const parsed = new URL(url);
  const host = parsed.hostname.replace(/^(?:www\.|m\.)/u, "");
  if (!YOUTUBE_HOSTS.has(host)) {
    return undefined;
  }
  const candidate =
    host === "youtu.be"
      ? parsed.pathname.slice(1)
      : (parsed.searchParams.get("v") ??
        parsed.pathname.split("/").findLast(Boolean));
  return candidate !== undefined && YOUTUBE_ID.test(candidate)
    ? candidate
    : undefined;
};
