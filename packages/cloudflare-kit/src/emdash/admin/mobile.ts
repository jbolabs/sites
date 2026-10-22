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
  /* The editor already fills the phone; its distraction-free toggle only took a row of its own. */
  html[data-theme] main form [data-sidebar-wrapper][data-side=right] > div > div:first-child > div:last-child > button {
    display: none;
  }
  /* Three counts read at a glance side by side instead of filling the first screen. */
  html[data-theme] main div:has(> [data-testid=dashboard-metric]) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.5rem;
  }
  html[data-theme] [data-testid=dashboard-metric] > div:first-child {
    padding: 0.75rem 0.75rem 0.5rem;
    overflow: hidden;
    font-size: 0.8125rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  html[data-theme] [data-testid=dashboard-metric] > div:last-child {
    padding: 0.75rem;
    font-size: 1.5rem;
  }
  /* Search gets its own full-width row at a touch height; filters follow it. */
  html[data-theme] main label:has(> input[type=search]) {
    flex-basis: 100%;
    height: 44px;
  }
  /* Lists scroll sideways: titles keep a readable width and other columns stay on one line. */
  html[data-theme] main div:has(> table) :is(th, td) {
    white-space: nowrap;
  }
  html[data-theme] main div:has(> table) td:nth-child(2) {
    min-width: 12rem;
    white-space: normal;
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
