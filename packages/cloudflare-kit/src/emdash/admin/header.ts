/** One quiet action row; appearance and account details belong in the account menu. */
export const ADMIN_HEADER_CSS = `
html[data-theme] [data-admin-header] {
  height: 58px;
  flex-wrap: nowrap;
  gap: 0.5rem;
  padding-inline: 1rem;
}
html[data-theme] [data-admin-header-actions] {
  gap: 0.375rem;
}
html[data-theme] [data-admin-header] [data-admin-icon-action] {
  width: 44px;
  height: 44px;
  padding: 0;
  justify-content: center;
}
html[data-theme] [data-admin-icon-action] svg {
  width: 20px;
  height: 20px;
}
html[data-theme] [data-admin-header] :is(button, a) {
  min-height: 44px;
  min-width: 44px;
  padding-inline: 0.625rem;
  border-color: transparent;
  background: transparent;
  color: var(--text-color-kumo-default);
  font-size: 0.875rem;
}
html[data-theme] [data-admin-header] :is(button, a):not(:focus-visible) {
  box-shadow: none;
}
html[data-theme] [data-admin-header] :is(button, a):is(:active, [aria-expanded=true]) {
  background: var(--color-kumo-tint);
}
html[data-theme] [data-admin-header] [data-admin-account] {
  width: 44px;
  justify-content: center;
  padding: 0;
  border-radius: 50%;
}
html[data-theme] [data-admin-header] [data-sidebar=trigger] {
  padding-inline: 0;
}
html[data-theme] [data-admin-account] [data-admin-avatar] {
  width: 2rem;
  height: 2rem;
  flex: 0 0 2rem;
  border-radius: 50%;
  font-size: 0.875rem;
}
html[data-theme] [data-admin-account-menu] :is(a, button) {
  min-height: 44px;
  font-size: 0.875rem;
}
html[data-theme] [data-admin-theme-toggle] {
  width: 100%;
  justify-content: flex-start;
  gap: 0.5rem;
  box-shadow: none;
}
@media (hover: hover) and (pointer: fine) {
  html[data-theme] [data-admin-header] :is(button, a):hover {
    background: var(--color-kumo-tint);
  }
}
@media (max-width: 767px) {
  html[data-theme] [data-admin-header] {
    padding-inline: 0.75rem;
  }
}
@media (min-width: 768px) {
  /* The desktop toggle stays in the sidebar header when collapsed. */
  html[data-theme] [data-admin-header] [data-sidebar=trigger] {
    display: none;
  }
}
`;
