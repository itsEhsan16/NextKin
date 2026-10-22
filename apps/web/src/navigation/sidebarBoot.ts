/** Where the sidebar remembers being collapsed (JSON `true`/`false`, through `src/lib/storage`). */
export const SIDEBAR_STORAGE_KEY = 'prefs.sidebarCollapsed';

/** On `<html>`; `theme.css`'s `rail` variant and `--sidebar-gutter` read it. */
export const SIDEBAR_ATTRIBUTE = 'data-sidebar';

/** Mirrors the remembered preference onto `<html>`, where the CSS reads it. */
export function applySidebarAttribute(collapsed: boolean): void {
  if (collapsed) document.documentElement.setAttribute(SIDEBAR_ATTRIBUTE, 'collapsed');
  else document.documentElement.removeAttribute(SIDEBAR_ATTRIBUTE);
}

/**
 * Runs inline at the top of `<body>`, before anything paints (`app/layout.tsx`).
 *
 * The server can't read `localStorage`, so it renders the expanded panel. Someone who keeps the
 * sidebar collapsed used to see that panel first, then watch it animate shut on every page load
 * while the whole page slid 168px left (`toreview.md` §84). Setting the attribute before the
 * first paint lets the CSS draw the rail straight away; React only catches up on what CSS
 * can't express (labels for assistive tech, tab order). Written out by hand rather than through
 * `storage`, because it runs before any module has loaded.
 */
export const sidebarBootScript = `try{if(JSON.parse(localStorage.getItem(${JSON.stringify(
  SIDEBAR_STORAGE_KEY,
)}))===true)document.documentElement.setAttribute(${JSON.stringify(
  SIDEBAR_ATTRIBUTE,
)},'collapsed')}catch(e){}`;
