/**
 * Addresses from the old agapeoc.com and where they live now. They are
 * answered in the Worker (`worker.ts`), not with CMS redirects: EmDash skips
 * any path with a file extension, and every old page ended in `.html`.
 */
/** Each page on the new site, with the old addresses that now lead to it. */
const OLD_ADDRESSES = {
  "/": ["/index.html"],
  "/beliefs": ["/believe.html"],
  "/bible-reading-plan": [
    "/bible 24.html",
    "/bible.html",
    "/bible2013.html",
    "/bible2014.html",
    "/bible25.html",
  ],
  "/bible-studies": ["/studies.html"],
  "/calendar": ["/calendar.html"],
  "/contact": ["/contact.html"],
  "/give": ["/donations.html"],
  "/leadership": ["/pastors.html"],
  "/live": ["/live.html", "/low.html"],
  "/ministries/awana": ["/awana.html"],
  "/ministries/bus": ["/bus.html"],
  "/ministries/charity": ["/charity.html"],
  "/ministries/children": ["/children.html", "/kids.html"],
  "/ministries/evangelism": [
    "/baptism2011.html",
    "/baptism2012.html",
    "/baptism2013.html",
    "/evangelism.html",
  ],
  "/ministries/hospitality": ["/hospitality.html"],
  "/ministries/marriage-family": ["/marriage.html"],
  "/ministries/media": ["/mediam.html"],
  "/ministries/recreation": ["/recreation.html"],
  "/ministries/small-groups": ["/groups.html"],
  "/ministries/ushers": ["/usher.html"],
  "/ministries/vbs": ["/vbs.html"],
  "/ministries/women": ["/women.html"],
  "/ministries/worship": ["/worship.html"],
  "/ministries/youth": ["/youth.html"],
  "/privacy": ["/privacy.html"],
  "/romanian-churches": ["/links.html"],
  "/site-map": ["/site.html"],
  "/vision": ["/vision.html"],
  "/visit": ["/services.html"],
  "/watch": [
    "/archive.html",
    "/audio.html",
    "/html5/sermons/index.html",
    "/last.html",
    "/sunday-sermons.html",
    "/video.html",
  ],
} as const satisfies Record<string, readonly string[]>;

/** Old path (lowercase, decoded) to new path. */
export const LEGACY_REDIRECTS: ReadonlyMap<string, string> = new Map(
  Object.entries(OLD_ADDRESSES).flatMap(([destination, sources]) =>
    sources.map((source) => [source, destination] as const)
  )
);

/** The new path for an old agapeoc.com URL, or `undefined` for anything else. */
export const legacyRedirect = (url: URL): string | undefined => {
  let path: string;
  try {
    path = decodeURIComponent(url.pathname).toLowerCase();
  } catch {
    return undefined;
  }
  return LEGACY_REDIRECTS.get(path);
};
