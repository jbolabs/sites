/** EmDash owns the navigation root; use its trigger rather than changing drawer classes. */
export const installMobileNavigation = (): void => {
  const mobile = matchMedia("(max-width: 767px)");
  const syncLabels = () => {
    const trigger = document.querySelector<HTMLButtonElement>(
      "header [data-sidebar=trigger]"
    );
    const nav = document.querySelector<HTMLElement>(
      "[data-sidebar=sidebar][data-mobile=true][data-side=left]"
    );
    if (trigger !== null) {
      const collapsed =
        trigger.closest<HTMLElement>("[data-sidebar-wrapper]")?.dataset
          .state === "collapsed";
      const desktopLabel = collapsed ? "Expand sidebar" : "Collapse sidebar";
      trigger.setAttribute(
        "aria-label",
        mobile.matches ? "Menu" : desktopLabel
      );
      const expanded = mobile.matches
        ? nav?.dataset.state === "expanded"
        : !collapsed;
      trigger.setAttribute("aria-expanded", String(expanded));
    }
    const close = nav?.querySelector("[data-sidebar=trigger]");
    close?.setAttribute("aria-label", "Close menu");
    close?.setAttribute(
      "aria-expanded",
      String(nav?.dataset.state === "expanded")
    );
  };
  // Kumo's trigger labels follow desktop collapse state, independently of the mobile drawer.
  const observer = new MutationObserver(syncLabels);
  observer.observe(document.body, {
    attributeFilter: ["data-state"],
    attributes: true,
    childList: true,
    subtree: true,
  });
  mobile.addEventListener("change", syncLabels);
  syncLabels();
  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element) || event.button !== 0) {
      return;
    }
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    const link = event.target.closest<HTMLAnchorElement>(
      "[data-sidebar=sidebar][data-mobile=true][data-side=left] a[href]"
    );
    if (
      link === null ||
      link.target === "_blank" ||
      link.hasAttribute("download")
    ) {
      return;
    }
    const destination = new URL(link.href);
    if (
      destination.origin !== location.origin ||
      !destination.pathname.startsWith("/_emdash/admin/")
    ) {
      return;
    }
    // After the router handles the link. A menu selection should reveal its destination.
    requestAnimationFrame(() => {
      const nav = link.closest<HTMLElement>("[data-sidebar=sidebar]");
      if (nav?.dataset.state === "expanded") {
        nav.querySelector<HTMLButtonElement>("[data-sidebar=trigger]")?.click();
      }
    });
  });
};
