/** Keep collapse in one fixed spot; Kumo owns resize, focus and drawer state. */
export const ADMIN_SIDEBAR_CSS = `
html[data-theme] .emdash-sidebar .admin-sidebar-header {
  height: 58px;
  padding: 0 6.5px;
  gap: 6px;
  border: 0;
}
html[data-theme] .admin-sidebar-header [data-sidebar=trigger] {
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
}
html[data-theme] .admin-sidebar-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  overflow: hidden;
  flex: 1;
}
html[data-theme] .emdash-sidebar[data-state=collapsed]:not([data-mobile]) .admin-sidebar-brand {
  display: none;
}
html[data-theme] .emdash-sidebar [data-sidebar=resize-handle] {
  touch-action: none;
}
@media (max-width: 767px) {
  /*
   * Phones get the sites' MobileMenu pattern (packages/site-ui): a full-width overlay under
   * the header, which stays put with its hamburger, instead of a drawer sliding over it.
   * The nav itself stays EmDash's, so groups, icons, permissions and plugins carry over.
   */
  html[data-theme] .emdash-sidebar[data-mobile] {
    top: calc(58px + env(safe-area-inset-top, 0px));
    bottom: 0;
    width: 100%;
    height: auto;
    padding-top: 0;
    border: 0;
    translate: none;
    opacity: 0;
    pointer-events: none;
    transition: opacity 200ms ease-out;
  }
  html[data-theme] .emdash-sidebar[data-mobile][data-state=expanded] {
    opacity: 1;
    pointer-events: auto;
  }
  html[data-theme] .emdash-sidebar[data-mobile] [data-sidebar=content] {
    padding: 0.5rem 0.5rem 1.5rem;
    translate: 0 -10px;
    transition: translate 320ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  html[data-theme] .emdash-sidebar[data-mobile][data-state=expanded] [data-sidebar=content] {
    translate: 0 0;
  }
  /* The header's toggle opens and closes it; a second toggle and the dimmed backdrop would only repeat that. */
  html[data-theme] .emdash-sidebar[data-mobile] .admin-sidebar-header,
  html[data-theme] [data-sidebar-wrapper][data-side=left] > [data-sidebar-backdrop] {
    display: none;
  }
  /* The admin scrolls inside <main>, not the body. */
  html:has(.emdash-sidebar[data-mobile][data-state=expanded]) :is(body, main) {
    overflow: hidden;
  }
  html[data-theme] [data-admin-header] [data-sidebar=trigger] {
    position: relative;
    width: 44px;
    flex: 0 0 44px;
  }
  /* Two bars that cross into an X, as on the public sites. */
  html[data-theme] [data-admin-menu-bar] {
    position: absolute;
    width: 22px;
    height: 2px;
    border-radius: 9999px;
    background: currentColor;
    transition: transform 300ms ease-out;
  }
  html[data-theme] [data-admin-menu-bar]:first-child {
    transform: translateY(-4px);
  }
  html[data-theme] [data-admin-menu-bar]:last-child {
    transform: translateY(4px);
  }
  html[data-theme] [data-admin-menu-toggle][aria-expanded=true] [data-admin-menu-bar]:first-child {
    transform: rotate(45deg);
  }
  html[data-theme] [data-admin-menu-toggle][aria-expanded=true] [data-admin-menu-bar]:last-child {
    transform: rotate(-45deg);
  }
  html[data-theme] .emdash-sidebar [data-sidebar=resize-handle] {
    display: none;
  }
}
@media (max-width: 767px) and (prefers-reduced-motion: reduce) {
  html[data-theme] .emdash-sidebar[data-mobile],
  html[data-theme] .emdash-sidebar[data-mobile] [data-sidebar=content],
  html[data-theme] [data-admin-menu-bar] {
    transition: none;
  }
}
`;
