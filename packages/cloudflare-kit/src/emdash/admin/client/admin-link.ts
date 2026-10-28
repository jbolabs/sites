/**
 * The assistant links what it changed into the admin. A plain link reloads the
 * whole admin, which closes the panel and takes seconds on a phone; EmDash's
 * own router (TanStack Router, which registers itself on `__TSR_ROUTER__`)
 * switches screens in place instead.
 */
const ADMIN_ROOT = "/_emdash/admin/";

/** The path to open in place, or undefined for a link that should load normally. */
export const adminLinkPath = (
  href: string,
  origin: string
): string | undefined => {
  const url = new URL(href, origin);
  return url.origin === origin && url.pathname.startsWith(ADMIN_ROOT)
    ? `${url.pathname}${url.search}${url.hash}`
    : undefined;
};

declare global {
  /** Set by TanStack Router in the browser; read through `isAdminRouter`. */
  var __TSR_ROUTER__: unknown;
}

interface AdminRouter {
  readonly navigate: (options: { readonly href: string }) => Promise<void>;
}

const isAdminRouter = (value: unknown): value is AdminRouter =>
  typeof value === "object" &&
  value !== null &&
  "navigate" in value &&
  typeof value.navigate === "function";

const adminRouter = (): AdminRouter | undefined => {
  const router = globalThis.__TSR_ROUTER__;
  return isAdminRouter(router) ? router : undefined;
};

/**
 * Opens an admin link from inside a reply in place; returns whether it did.
 * Modified clicks (new tab) and links outside the admin keep the browser's default.
 */
export const openAdminLink = (event: {
  readonly target: EventTarget | null;
  readonly button: number;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  readonly preventDefault: () => void;
}): boolean => {
  const modified =
    event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
  if (event.button !== 0 || modified || !(event.target instanceof Element)) {
    return false;
  }
  const link = event.target.closest<HTMLAnchorElement>("a[href]");
  const router = adminRouter();
  const path =
    link === null || link.target === "_blank"
      ? undefined
      : adminLinkPath(link.href, location.origin);
  if (path === undefined || router === undefined) {
    return false;
  }
  event.preventDefault();
  void router.navigate({ href: path });
  return true;
};
