/**
 * EmDash's dashboard puts plugin cards last, under counts and recent edits. A client
 * who opens the admin to see what is booked today should find that card first, so a
 * site can lead with its cards (`dashboard.widgetsFirst`). They keep the order of the
 * site's `plugins` list.
 *
 * The dashboard is the page whose children include the counts grid (EmDash marks each
 * count `dashboard-metric`); its title row stays on top and the cards, its last child,
 * come next. EmDash spaces the children with margins (`space-y-6`), which an order
 * change would put on the wrong side, so it becomes a flex column with the same gap.
 */
const DASHBOARD =
  "html[data-theme] main div:has(> div > h1):has(> div > [data-testid=dashboard-metric])";

export const adminDashboardCss = (
  options: { readonly widgetsFirst?: boolean } = {}
): string =>
  options.widgetsFirst === true
    ? [
        `${DASHBOARD}{display:flex;flex-direction:column;gap:1.5rem}`,
        `${DASHBOARD} > *{margin-block:0}`,
        `${DASHBOARD} > div:has(> h1){order:-2}`,
        `${DASHBOARD} > :last-child{order:-1}`,
      ].join("\n")
    : "";
