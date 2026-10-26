/**
 * Caches EmDash's resized photos. Its `/_image` endpoint reads the original
 * from R2 and runs the Images binding on every request, and answers with
 * `max-age=0, must-revalidate` and no validator (CMS "Replace original" keeps
 * the storage key), so neither the browser nor the edge keeps a copy and every
 * page view waits on fresh resizes: the boxes stay empty while they run.
 *
 * Here the shared copy is keyed on the original's R2 ETag, so a replaced
 * original misses the cache and an unchanged one comes from the data center.
 * Browsers get that ETag too: a revisit shows its copy at once and revalidates
 * in the background, and a replaced photo shows from the visit after.
 */
import { matchInternalMediaKey } from "emdash/media/image-endpoint";

interface ImageCacheEnv {
  /** The media bucket; only the original's current ETag is read. */
  readonly MEDIA: {
    readonly head: (
      key: string
    ) => Promise<{ readonly httpEtag: string } | null>;
  };
}

const IMAGE_ENDPOINT = "/_image";
const CACHE_NAME = "emdash-image-v1";
/** Keyed on the original's ETag, so the shared copy never goes stale. */
const SHARED_CACHE_CONTROL = "public, max-age=31536000, immutable";
/** A minute fresh, then shown at once while the browser revalidates. */
export const VISITOR_CACHE_CONTROL =
  "public, max-age=60, stale-while-revalidate=604800";
const NOT_MODIFIED = 304;
const BYPASS_HEADERS = ["authorization", "cookie", "range"];

/** The R2 key of the original an `/_image` request resizes, or undefined to pass it through. */
export const transformedMediaKey = (request: Request): string | undefined => {
  const url = new URL(request.url);
  if (
    (request.method !== "GET" && request.method !== "HEAD") ||
    url.pathname !== IMAGE_ENDPOINT ||
    BYPASS_HEADERS.some((name) => request.headers.has(name))
  ) {
    return undefined;
  }
  return matchInternalMediaKey(url.searchParams.get("href")) ?? undefined;
};

const etagMatches = (request: Request, etag: string): boolean =>
  (request.headers.get("if-none-match") ?? "").split(",").some((candidate) => {
    const tag = candidate.trim();
    return tag === "*" || tag === etag || tag === `W/${etag}`;
  });

const visitorResponse = (
  response: Response,
  etag: string,
  state: "HIT" | "MISS"
): Response => {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", VISITOR_CACHE_CONTROL);
  headers.set("ETag", etag);
  headers.set("X-Image-Cache", state);
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
};

const storeImage = async (
  cache: Pick<Cache, "put">,
  key: Request,
  response: Response
): Promise<void> => {
  try {
    await cache.put(key, response);
  } catch {
    // A cache failure must not take photos down.
  }
};

export const fetchCachedImage = async (
  request: Request,
  env: ImageCacheEnv,
  ctx: Pick<ExecutionContext, "waitUntil">,
  render: () => Promise<Response>,
  cache?: Pick<Cache, "match" | "put">
): Promise<Response> => {
  const mediaKey = transformedMediaKey(request);
  if (mediaKey === undefined) {
    return await render();
  }
  let etag: string;
  let storage: Pick<Cache, "match" | "put">;
  try {
    const original = await env.MEDIA.head(mediaKey);
    if (original === null) {
      return await render();
    }
    etag = original.httpEtag;
    storage = cache ?? (await caches.open(CACHE_NAME));
  } catch {
    return await render();
  }
  if (etagMatches(request, etag)) {
    return new Response(null, {
      headers: { "Cache-Control": VISITOR_CACHE_CONTROL, ETag: etag },
      status: NOT_MODIFIED,
    });
  }
  // Only the URL (the transform) and the original's version select a copy.
  const keyUrl = new URL(request.url);
  keyUrl.searchParams.set("__media_etag", etag);
  const key = new Request(keyUrl);
  try {
    const hit = await storage.match(key);
    if (hit !== undefined) {
      return visitorResponse(hit, etag, "HIT");
    }
  } catch {
    // A cache failure must not take photos down.
  }
  const response = await render();
  if (
    request.method !== "GET" ||
    response.status !== 200 ||
    !(response.headers.get("content-type") ?? "").startsWith("image/")
  ) {
    return response;
  }
  const stored = response.clone();
  const headers = new Headers(stored.headers);
  headers.set("Cache-Control", SHARED_CACHE_CONTROL);
  ctx.waitUntil(
    storeImage(storage, key, new Response(stored.body, { headers }))
  );
  return visitorResponse(response, etag, "MISS");
};
