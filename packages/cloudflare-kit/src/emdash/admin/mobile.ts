/** A content list (Pages, Products, ...): EmDash marks each row's date cell. */
const LIST = "html[data-theme] main table:has(td[data-testid=content-updated])";

/**
 * A sideways-scrolling table hid each row's status off screen. On a phone each row is a card:
 * the title and its status, then the list's own columns, each named by `client/admin-marks.ts`,
 * which also marks the status cell.
 * The whole card opens the entry. Bulk selection, the date, and the row's icon buttons stay
 * on desktop, and so does sorting by a column, on purpose: a phone list should only find and open.
 * The editor has Live View, and Move to Trash under Settings, both with names.
 */
const CONTENT_LIST_CARDS = `
  ${LIST} thead {
    display: none;
  }
  ${LIST}, ${LIST} tbody {
    display: block;
  }
  ${LIST} tr {
    position: relative;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 0.75rem;
    padding: 0.875rem 1rem;
  }
  /* Ends the title line, so the list's own columns start below it. */
  ${LIST} tr::after {
    content: "";
    order: 1;
    flex-basis: 100%;
  }
  ${LIST} tr:active {
    background: var(--color-kumo-tint);
  }
  ${LIST} td {
    display: block;
    min-width: 0;
    max-width: none;
    padding: 0;
    white-space: normal;
  }
  ${LIST} :is(td:has(> [role=checkbox]), td[data-testid=content-updated]) {
    display: none;
  }
  /* The title keeps a readable width; a status that will not fit beside it drops below. */
  ${LIST} td:has(> a[href^="/_emdash/admin/content/"]) {
    flex: 1 1 9rem;
    min-width: 0;
    font-size: 1rem;
  }
  ${LIST} td > a[href^="/_emdash/admin/content/"] {
    display: inline;
    min-height: 0;
    min-width: 0;
  }
  ${LIST} td > a[href^="/_emdash/admin/content/"]::after {
    content: "";
    position: absolute;
    inset: 0;
  }
  ${LIST} td[data-admin-cell=status] {
    flex: 0 1 auto;
  }
  ${LIST} td[data-admin-cell=status] > span {
    flex-wrap: wrap;
  }
  ${LIST} td[data-label] {
    order: 2;
    color: var(--text-color-kumo-subtle);
    font-size: 0.875rem;
  }
  ${LIST} td[data-label]::before {
    content: attr(data-label) ": ";
  }
  ${LIST} td[data-label] > span {
    display: inline;
    color: var(--text-color-kumo-default);
    white-space: normal;
  }
  ${LIST} td:last-child {
    display: none;
  }`;

/** A list's Trash tab: EmDash's restore buttons are its only hook. */
const TRASH = 'html[data-theme] main table:has(button[aria-label^="Restore "])';

/** The Trash tab as cards too, with Restore named, since the skill and the guide send clients there. */
const TRASH_CARDS = `
  ${TRASH} thead {
    display: none;
  }
  ${TRASH}, ${TRASH} tbody {
    display: block;
  }
  ${TRASH} tr {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 0.75rem;
    padding: 0.75rem 1rem;
  }
  ${TRASH} td {
    display: block;
    padding: 0;
    white-space: normal;
  }
  ${TRASH} td:first-child {
    flex: 1 1 9rem;
    min-width: 0;
    font-size: 1rem;
  }
  ${TRASH} td:last-child {
    margin-inline-start: auto;
  }
  ${TRASH} button[aria-label^="Restore "] {
    width: auto;
    gap: 0.375rem;
    padding-inline: 0.75rem;
  }
  ${TRASH} button[aria-label^="Restore "]::after {
    content: "Restore";
  }`;

/** The entry editor's scrolling column; its first child is the title row with the actions. */
const EDITOR =
  "html[data-theme] main form [data-sidebar-wrapper][data-side=right] > div:has(> div:first-child fieldset button[type=submit])";
const EDITOR_ACTIONS = `${EDITOR} > div:first-child fieldset`;
/** EmDash labels its publish button "Publish now" or "Publish changes"; "Unpublish …" stays up top. */
const PUBLISH =
  'button:is([aria-label="Publish now"], [aria-label="Publish changes"])';
const BAR_INSET = "calc(0.875rem + env(safe-area-inset-bottom, 0px))";

/**
 * Save and Publish ride in a bar along the bottom of the screen, under the thumb and never
 * scrolled away below a long form; Live View, Settings, and Unpublish stay in the title row.
 * While the keyboard is up the bar hides, so it never floats over the field being typed in.
 */
const EDITOR_ACTION_BAR = `
  ${EDITOR} {
    padding-bottom: calc(6rem + env(safe-area-inset-bottom, 0px));
  }
  /* Its backdrop filter would make the title row, not the screen, the bar's containing block. */
  ${EDITOR} > div:first-child {
    backdrop-filter: none;
  }
  ${EDITOR}:has(:is(input:not([type=checkbox], [type=radio]), textarea, [contenteditable=true]):focus) > div:first-child fieldset :is(button[type=submit], ${PUBLISH}) {
    visibility: hidden;
  }
  ${EDITOR}:has(:is(input:not([type=checkbox], [type=radio]), textarea, [contenteditable=true]):focus) > div:first-child fieldset::before {
    display: none;
  }
  /* 20 and 21 keep the bar under Kumo's Settings sheet and dialogs, which must cover it. */
  ${EDITOR_ACTIONS}:has(button[type=submit])::before {
    content: "";
    position: fixed;
    z-index: 20;
    inset-inline: 0;
    bottom: 0;
    height: calc(4.75rem + env(safe-area-inset-bottom, 0px));
    background: var(--color-kumo-elevated);
    box-shadow: 0 -1px 0 var(--color-kumo-line);
  }
  ${EDITOR_ACTIONS} :is(button[type=submit], ${PUBLISH}) {
    position: fixed;
    z-index: 21;
    bottom: ${BAR_INSET};
    left: max(1rem, env(safe-area-inset-left, 0px));
    right: max(1rem, env(safe-area-inset-right, 0px));
    width: auto;
    height: 3rem;
    justify-content: center;
    font-size: 1rem;
  }
  ${EDITOR_ACTIONS}:has(${PUBLISH}) button[type=submit] {
    right: calc(50% + 0.25rem);
  }
  ${EDITOR_ACTIONS} ${PUBLISH} {
    left: calc(50% + 0.25rem);
  }`;

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
  /*
   * Cards show no dates, so a date filter's result cannot be seen; search and status remain.
   * Only while no range is set: a range set on desktop stays visible so it can be cleared.
   */
  html[data-theme] main :has(> button[aria-label="Filter by date range: Date range"]) :is(button[aria-label="Date field to filter on"], button[aria-label="Filter by date range: Date range"]) {
    display: none;
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
  /* An empty list is one sentence; its column headings pushed it off screen. */
  html[data-theme] main table:has(> tbody > tr:only-child > td[colspan]) thead {
    display: none;
  }
  html[data-theme] main div:has(> table) td[colspan] {
    white-space: normal;
  }
  /* Kumo fixes the tab row at 30px; 44px tabs overflowed it and its underline crossed the labels. */
  html[data-theme] main [role=tablist] {
    height: auto;
    padding-bottom: 0;
  }
${CONTENT_LIST_CARDS}
${TRASH_CARDS}
${EDITOR_ACTION_BAR}
}
/* Capability-based: tablets with touch benefit too, regardless of viewport width. */
@media (pointer: coarse) {
  /* An app, not a document: pulling down must not reload the page over unsaved edits. */
  html[data-theme], html[data-theme] body {
    overscroll-behavior: none;
  }
  html[data-theme] :is(button, a, [role=button], [role=tab]) {
    touch-action: manipulation;
  }
  html[data-theme] :is(button, [role=button], [role=tab]) {
    -webkit-user-select: none;
    user-select: none;
  }
  /* Menu items and list cards are controls: a long press should not offer to open a link. */
  html[data-theme] :is(button, [data-sidebar=menu-button], main table a) {
    -webkit-touch-callout: none;
  }
  /* Kumo's hover tint never shows on touch; the press does instead. */
  html[data-theme] [data-sidebar=menu-button]:active {
    background: var(--sidebar-active-bg, var(--color-kumo-tint));
  }
}
`;
