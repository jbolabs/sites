/**
 * One public address per site: `www.<domain>` and plain HTTP on the domain
 * answer 301 to `https://<domain>`, path and query kept. Done in the Worker
 * because the edge alternatives (zone redirect rules, Always Use HTTPS) need
 * zone permissions the CI deploy tokens deliberately lack. Origins that are not
 * HTTPS (local dev) and every other hostname (workers.dev versions) pass through.
 */
const MOVED_PERMANENTLY = 301;

export const canonicalRedirect = (
  request: Request,
  siteOrigin: string
): Response | undefined => {
  const canonical = new URL(siteOrigin);
  if (canonical.protocol !== "https:") {
    return undefined;
  }
  const url = new URL(request.url);
  const www = url.hostname === `www.${canonical.hostname}`;
  const plainHttp =
    url.protocol === "http:" && url.hostname === canonical.hostname;
  if (!(www || plainHttp)) {
    return undefined;
  }
  return Response.redirect(
    new URL(`${url.pathname}${url.search}`, canonical.origin).toString(),
    MOVED_PERMANENTLY
  );
};
