/**
 * The assistant links what it changed into the admin. A plain link reloads the
 * whole admin, which closes the panel and takes seconds on a phone; EmDash's
 * own router (TanStack Router, which registers itself on `__TSR_ROUTER__`)
 * switches screens in place instead, after dropping cached content so the
 * screen shows the assistant's draft.
 */
const ADMIN_ROOT = "/_emdash/admin/";

/**
 * The path to open in place, or undefined for a link that should load normally:
 * outside the admin, another site, or the screen already open (`here`), which
 * would not change at all, while a full load shows the assistant's draft.
 */
export const adminLinkPath = (
  href: string,
  origin: string,
  here: string
): string | undefined => {
  const url = new URL(href, origin);
  const path = `${url.pathname}${url.search}${url.hash}`;
  return url.origin === origin &&
    url.pathname.startsWith(ADMIN_ROOT) &&
    path !== here
    ? path
    : undefined;
};

declare global {
  /** Set by TanStack Router in the browser; read through `isAdminRouter`. */
  var __TSR_ROUTER__: unknown;
}

interface QueryClient {
  readonly invalidateQueries: (filters: {
    readonly queryKey: readonly string[];
    readonly refetchType: "none";
  }) => Promise<void>;
}

interface AdminRouter {
  readonly navigate: (options: { readonly href: string }) => Promise<void>;
  /** EmDash's `createAdminRouter` passes its query client as router context. */
  readonly options: { readonly context: { readonly queryClient: QueryClient } };
}

const isQueryClient = (value: unknown): value is QueryClient =>
  typeof value === "object" &&
  value !== null &&
  "invalidateQueries" in value &&
  typeof value.invalidateQueries === "function";

const isAdminRouter = (value: unknown): value is AdminRouter => {
  if (typeof value !== "object" || value === null || !("options" in value)) {
    return false;
  }
  if (!("navigate" in value) || typeof value.navigate !== "function") {
    return false;
  }
  const { options } = value;
  if (
    typeof options !== "object" ||
    options === null ||
    !("context" in options)
  ) {
    return false;
  }
  const { context } = options;
  return (
    typeof context === "object" &&
    context !== null &&
    "queryClient" in context &&
    isQueryClient(context.queryClient)
  );
};

/** EmDash caches content for a minute; the assistant may have just changed what the link opens. */
const openInPlace = async (router: AdminRouter, path: string) => {
  // Marked stale only: refetching the screen being left would delay the one being opened.
  await router.options.context.queryClient.invalidateQueries({
    queryKey: ["content"],
    refetchType: "none",
  });
  await router.navigate({ href: path });
};

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
      : adminLinkPath(
          link.href,
          location.origin,
          `${location.pathname}${location.search}${location.hash}`
        );
  if (path === undefined || router === undefined) {
    return false;
  }
  event.preventDefault();
  void openInPlace(router, path);
  return true;
};
