/** Phone layout only; desktop retains EmDash's density and the shared inset shell. */
export const ADMIN_MOBILE_CSS = `
@media (max-width: 767px) {
  html[data-theme] body {
    padding-top: env(safe-area-inset-top, 0px);
    padding-inline: env(safe-area-inset-left, 0px) env(safe-area-inset-right, 0px);
  }
  html[data-theme] [data-sidebar-wrapper][data-side=left] {
    height: calc(100dvh - env(safe-area-inset-top, 0px)) !important; /* EmDash sets 100svh inline, leaving space when browser chrome retracts. */
  }
  html[data-theme] [data-sidebar-wrapper],
  html[data-theme] [data-sidebar-wrapper] > div,
  html[data-theme] main form,
  html[data-theme] main fieldset,
  html[data-theme] main [id],
  html[data-theme] [data-block-key] {
    min-width: 0;
  }
  /* A grid field's implicit auto track otherwise keeps the block toolbar's min-content width. */
  html[data-theme] main form [id^=field-] {
    grid-template-columns: minmax(0, 1fr);
  }
  html[data-theme] main:not(:has(> form)) {
    padding: 1rem;
  }
  html[data-theme] main form [data-sidebar-wrapper][data-side=right] > div {
    padding: 1rem;
    overscroll-behavior-y: contain;
  }
  html[data-theme] main form [data-sidebar-wrapper][data-side=right] > div > div:first-child > div:last-child {
    width: 100%;
    flex-wrap: wrap;
    justify-content: flex-start;
  }
  html[data-theme] main form [data-sidebar-wrapper][data-side=right] > div > div:first-child fieldset {
    justify-content: flex-start;
  }
  html[data-theme] [data-sidebar=sidebar][data-mobile=true] {
    padding-top: env(safe-area-inset-top, 0px);
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
  html[data-theme] [data-sidebar=content],
  html[data-theme] main {
    overscroll-behavior-y: contain;
  }
  html[data-theme] main footer {
    padding-bottom: max(0.75rem, env(safe-area-inset-bottom, 0px));
  }
  /* Native text-entry size avoids Safari zoom without limiting pinch zoom. */
  html[data-theme] :is(input:not([type=checkbox], [type=radio]), textarea, select, [contenteditable=true]) {
    font-size: 16px;
  }
  html[data-theme] :is(button, [role=button], [role=tab], [role=combobox], [data-sidebar=menu-button], [data-sidebar=menu-sub-button], a[data-kumo-component=LinkButton]),
  html[data-theme] main a:not(:has(img)):not([data-sidebar]) {
    min-height: 44px;
    min-width: 44px;
  }
  html[data-theme] :is(input:not([type=checkbox], [type=radio], [type=hidden], [aria-hidden=true], [tabindex="-1"], .sr-only), select) {
    min-height: 44px;
  }
  html[data-theme] main td > a {
    display: inline-flex;
    align-items: center;
  }
  html[data-theme] [data-sidebar=menu-button] {
    font-size: 15px;
  }
  /* The menu remains recognizable without knowing the sidebar icon. */
  html[data-theme] header [data-sidebar=trigger] {
    width: auto;
    gap: 0.375rem;
  }
  html[data-theme] header [data-sidebar=trigger]::after {
    content: "Menu";
    font-size: 14px;
  }
  html[data-theme] [data-sidebar=sidebar][data-mobile=true] [data-sidebar=trigger] {
    width: auto;
    gap: 0.5rem;
    padding-inline: 0.75rem;
  }
  html[data-theme] [data-sidebar=sidebar][data-mobile=true] [data-sidebar=trigger]::after {
    content: "Close menu";
    font-size: 14px;
  }
}
/* Capability-based: tablets with touch benefit too, regardless of viewport width. */
@media (pointer: coarse) {
  html[data-theme] :is(button, a, [role=button], [role=tab]) {
    touch-action: manipulation;
  }
  html[data-theme] :is(button, [role=button], [role=tab]) {
    -webkit-user-select: none;
    user-select: none;
  }
}
`;
