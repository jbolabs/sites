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
@media (min-width: 768px) {
  /* EmDash's bundled CSS does not include Kumo's sm:block utility on every site. */
  html[data-theme] .emdash-sidebar [data-sidebar=resize-handle] {
    display: block;
  }
}
@media (max-width: 767px) {
  html[data-theme] .emdash-sidebar[data-mobile] {
    width: min(var(--sidebar-width), calc(100vw - 32px));
  }
  html[data-theme] .emdash-sidebar .admin-sidebar-header {
    padding-inline: 12px;
    border-bottom: 1px solid transparent;
  }
  html[data-theme] [data-admin-header] [data-sidebar=trigger] {
    width: 44px;
    flex: 0 0 44px;
  }
  html[data-theme] .emdash-sidebar [data-sidebar=resize-handle] {
    display: none;
  }
}
`;
