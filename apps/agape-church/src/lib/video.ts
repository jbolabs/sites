/**
 * Turns the YouTube and Vimeo links editors paste into embed URLs. Players
 * load only when a visitor presses play (see `lite-embed.astro`), and YouTube
 * uses its no-cookie domain.
 */
export interface VideoEmbed {
  readonly provider: "youtube" | "vimeo";
  readonly embedUrl: string;
}

const YOUTUBE_ID = /^[\w-]{11}$/u;
const VIMEO_ID = /^\d+$/u;
const VIMEO_HASH = /^[\da-f]{6,}$/u;

const youtubeId = (url: URL): string | undefined => {
  const host = url.hostname.replace(/^(?:www|m)\./u, "");
  const segments = url.pathname.split("/").filter((part) => part !== "");
  const pathId = ["embed", "live", "shorts"].includes(segments[0] ?? "")
    ? segments[1]
    : undefined;
  const candidate =
    host === "youtu.be" ? segments[0] : (url.searchParams.get("v") ?? pathId);
  return candidate !== undefined && YOUTUBE_ID.test(candidate)
    ? candidate
    : undefined;
};

export const videoEmbed = (link: string): VideoEmbed | undefined => {
  let url: URL;
  try {
    url = new URL(link.startsWith("//") ? `https:${link}` : link);
  } catch {
    return undefined;
  }
  const host = url.hostname.replace(/^www\./u, "");
  if (
    host === "youtube.com" ||
    host.endsWith(".youtube.com") ||
    host === "youtu.be"
  ) {
    const id = youtubeId(url);
    return id === undefined
      ? undefined
      : {
          embedUrl: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`,
          provider: "youtube",
        };
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const segments = url.pathname.split("/").filter((part) => part !== "");
    const index = segments.findIndex((part) => VIMEO_ID.test(part));
    const id = segments[index];
    if (id === undefined) {
      return undefined;
    }
    // Unlisted videos carry a privacy hash: vimeo.com/<id>/<hash> or ?h=<hash>.
    const hash = url.searchParams.get("h") ?? segments[index + 1];
    const privacy =
      hash !== undefined && VIMEO_HASH.test(hash) ? `&h=${hash}` : "";
    return {
      embedUrl: `https://player.vimeo.com/video/${id}?autoplay=1&dnt=1${privacy}`,
      provider: "vimeo",
    };
  }
  return undefined;
};

/** The channel's live player: it shows the current stream, or the channel's next one. */
export const liveEmbedUrl = (channelId: string): string =>
  `https://www.youtube-nocookie.com/embed/live_stream?channel=${encodeURIComponent(channelId)}&autoplay=1`;
