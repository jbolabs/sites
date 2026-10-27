import { describe, expect, it, vi } from "vitest";

import { fetchCachedImage, transformedMediaKey } from "./image-cache.ts";

const ORIGIN = "https://example.com";
const TRANSFORM =
  "/_image?href=https%3A%2F%2Fexample.com%2F_emdash%2Fapi%2Fmedia%2Ffile%2F01HXYZ.jpg&w=640&h=480&f=webp";
const request = (path: string, options: RequestInit = {}) =>
  new Request(`${ORIGIN}${path}`, options);
const webp = (body: string, status = 200) =>
  new Response(body, {
    headers: {
      "cache-control": "public, max-age=0, must-revalidate",
      "content-type": "image/webp",
    },
    status,
  });

const fixture = () => {
  const values = new Map<string, Response>();
  const pending: Promise<void>[] = [];
  const cache = {
    match: vi.fn<(key: RequestInfo) => Promise<Response | undefined>>(
      async (key) =>
        await Promise.resolve(values.get(new Request(key).url)?.clone())
    ),
    put: vi.fn<(key: RequestInfo, response: Response) => Promise<void>>(
      async (key, response) => {
        values.set(new Request(key).url, response);
        await Promise.resolve();
      }
    ),
  };
  const objects = new Map([["01HXYZ.jpg", '"v1"']]);
  const env = {
    MEDIA: {
      head: async (key: string) =>
        await Promise.resolve(
          objects.has(key) ? { httpEtag: objects.get(key) ?? "" } : null
        ),
    },
  };
  const ctx = {
    waitUntil: (promise: Promise<void>) => {
      pending.push(promise);
    },
  };
  return { cache, ctx, env, objects, pending, values };
};

describe(transformedMediaKey, () => {
  it("reads the R2 key of the original a transform resizes", () => {
    expect(transformedMediaKey(request(TRANSFORM))).toBe("01HXYZ.jpg");
    expect(
      transformedMediaKey(
        request("/_image?href=%2F_emdash%2Fapi%2Fmedia%2Ffile%2Fa.png&w=320")
      )
    ).toBe("a.png");
  });

  it.each([
    "/_emdash/api/media/file/01HXYZ.jpg",
    "/_image?href=%2F_astro%2Flogo.png&w=320",
    "/_image?href=https%3A%2F%2Fcdn.example%2Fx.jpg",
    "/_image?href=%2F_emdash%2Fapi%2Fmedia%2Ffile%2F..%252Fsecret",
    "/_image",
    "/about",
  ])("passes %s through", (path) => {
    expect(transformedMediaKey(request(path))).toBeUndefined();
    expect(transformedMediaKey(request(TRANSFORM))).toBe("01HXYZ.jpg");
  });

  it.each(["authorization", "range"])(
    "passes requests carrying %s through",
    (name) => {
      expect(
        transformedMediaKey(request(TRANSFORM, { headers: { [name]: "x" } }))
      ).toBeUndefined();
      expect(
        transformedMediaKey(
          request(TRANSFORM, { headers: { cookie: "_ga=GA1.1.1" } })
        )
      ).toBe("01HXYZ.jpg");
    }
  );
});

describe(fetchCachedImage, () => {
  it("resizes once, then serves the shared copy with a revalidating browser policy", async () => {
    const { cache, ctx, env, pending } = fixture();
    const render = vi.fn<() => Promise<Response>>(
      async () => await Promise.resolve(webp("resized"))
    );
    const first = await fetchCachedImage(
      request(TRANSFORM),
      env,
      ctx,
      render,
      cache
    );
    expect(Object.fromEntries(first.headers)).toMatchObject({
      "cache-control": "public, max-age=60, stale-while-revalidate=604800",
      etag: '"v1"',
      "x-image-cache": "MISS",
    });
    await Promise.all(pending);
    const second = await fetchCachedImage(
      request(TRANSFORM),
      env,
      ctx,
      render,
      cache
    );
    expect(second.headers.get("x-image-cache")).toBe("HIT");
    await expect(second.text()).resolves.toBe("resized");
    expect(render).toHaveBeenCalledOnce();
  });

  it("keeps the shared copy under the original's version for a year", async () => {
    const { cache, ctx, env, pending, values } = fixture();
    await fetchCachedImage(
      request(TRANSFORM),
      env,
      ctx,
      async () => await Promise.resolve(webp("resized")),
      cache
    );
    await Promise.all(pending);
    const stored = values.get(`${ORIGIN}${TRANSFORM}&__media_etag=%22v1%22`);
    expect(stored?.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable"
    );
    await expect(stored?.text()).resolves.toBe("resized");
  });

  it("resizes again after the original is replaced", async () => {
    const { cache, ctx, env, objects, pending } = fixture();
    await fetchCachedImage(
      request(TRANSFORM),
      env,
      ctx,
      async () => await Promise.resolve(webp("old photo")),
      cache
    );
    await Promise.all(pending);
    objects.set("01HXYZ.jpg", '"v2"');
    const replaced = await fetchCachedImage(
      request(TRANSFORM),
      env,
      ctx,
      async () => await Promise.resolve(webp("new photo")),
      cache
    );
    expect(replaced.headers.get("etag")).toBe('"v2"');
    await expect(replaced.text()).resolves.toBe("new photo");
  });

  it("answers a browser holding the current version with 304", async () => {
    const { cache, ctx, env } = fixture();
    const render = vi.fn<() => Promise<Response>>(
      async () => await Promise.resolve(webp("resized"))
    );
    const response = await fetchCachedImage(
      request(TRANSFORM, { headers: { "if-none-match": 'W/"v0", "v1"' } }),
      env,
      ctx,
      render,
      cache
    );
    expect(response.status).toBe(304);
    expect(response.headers.get("etag")).toBe('"v1"');
    expect(render).not.toHaveBeenCalled();
  });

  it("sends a browser holding an older version the new photo", async () => {
    const { cache, ctx, env } = fixture();
    const response = await fetchCachedImage(
      request(TRANSFORM, { headers: { "if-none-match": '"v0"' } }),
      env,
      ctx,
      async () => await Promise.resolve(webp("resized")),
      cache
    );
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("resized");
  });

  it("does not keep a failed resize", async () => {
    const { cache, ctx, env, pending } = fixture();
    const failed = await fetchCachedImage(
      request(TRANSFORM),
      env,
      ctx,
      async () => await Promise.resolve(webp("Internal Server Error", 500)),
      cache
    );
    await Promise.all(pending);
    expect(failed.status).toBe(500);
    expect(failed.headers.get("x-image-cache")).toBeNull();
    expect(cache.put).not.toHaveBeenCalled();
  });

  it("does not keep a response that sets a cookie", async () => {
    const { cache, ctx, env, pending } = fixture();
    const response = await fetchCachedImage(
      request(TRANSFORM),
      env,
      ctx,
      async () =>
        await Promise.resolve(
          new Response("resized", {
            headers: { "content-type": "image/webp", "set-cookie": "s=1" },
          })
        ),
      cache
    );
    await Promise.all(pending);
    await expect(response.text()).resolves.toBe("resized");
    expect(response.headers.get("set-cookie")).toBe("s=1");
    expect(cache.put).not.toHaveBeenCalled();
  });

  it("leaves missing originals and other requests to the endpoint", async () => {
    const { cache, ctx, env } = fixture();
    const missing = await fetchCachedImage(
      request(TRANSFORM.replace("01HXYZ", "01GONE")),
      env,
      ctx,
      async () =>
        await Promise.resolve(new Response("Not Found", { status: 404 })),
      cache
    );
    expect(missing.status).toBe(404);

    const page = await fetchCachedImage(
      request("/about"),
      env,
      ctx,
      async () => await Promise.resolve(new Response("page")),
      cache
    );
    await expect(page.text()).resolves.toBe("page");
    expect(cache.match).not.toHaveBeenCalled();
  });
});
