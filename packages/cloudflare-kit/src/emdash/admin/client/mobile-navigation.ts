/** EmDash owns the navigation root; use its trigger rather than changing drawer classes. */
export const installMobileNavigation = (): void => {
  const mobile = matchMedia("(max-width: 767px)");
  let wasOpen = false;
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
      const navOpen = nav?.dataset.state === "expanded";
      const mobileLabel = navOpen ? "Close menu" : "Open menu";
      trigger.setAttribute(
        "aria-label",
        mobile.matches ? mobileLabel : desktopLabel
      );
      const expanded = mobile.matches ? navOpen : !collapsed;
      trigger.setAttribute("aria-expanded", String(expanded));
    }
    // Kumo focuses the menu's own toggle on open, which phones hide; start at the first link instead.
    const open = mobile.matches && nav?.dataset.state === "expanded";
    if (open && !wasOpen) {
      requestAnimationFrame(() => {
        nav
          ?.querySelector<HTMLElement>("[data-sidebar=content] a[href]")
          ?.focus({ preventScroll: true });
      });
    }
    // Closing makes the focused link inert, which drops focus to <body>; hand it back to the toggle.
    if (!open && wasOpen) {
      requestAnimationFrame(() => {
        if (
          document.activeElement === document.body ||
          nav?.contains(document.activeElement) === true
        ) {
          trigger?.focus({ preventScroll: true });
        }
      });
    }
    wasOpen = open;
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
  // Kumo closes the open menu when focus leaves it, so pressing the header toggle would close
  // it on focus and reopen it on click. Keeping focus in the menu lets the click close it.
  document.addEventListener("mousedown", (event) => {
    if (
      mobile.matches &&
      event.target instanceof Element &&
      event.target.closest("header [data-sidebar=trigger]") !== null &&
      document.querySelector(
        "[data-sidebar=sidebar][data-mobile=true][data-side=left][data-state=expanded]"
      ) !== null
    ) {
      event.preventDefault();
    }
  });
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
