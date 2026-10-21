/**
 * Inline SVG constants for the WebDAV sync UI.
 *
 * 13px currentColor line icons (Lucide style) matching the existing
 * toolbar / update-module icon language.
 */

function svg(paths: string, size = 13): string {
  return (
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" ` +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
    `stroke-linejoin="round" aria-hidden="true">${paths}</svg>`
  );
}

const CLOUD =
  '<path d="M17.5 19a4.5 4.5 0 1 0-.42-8.98 6 6 0 1 0-11.06 3.1"/>' +
  '<path d="M17.5 19H7a4 4 0 0 1-1.33-7.76"/>';

export const SYNC_ICONS = {
  /** Idle / configured marker (kept for popover use; the toolbar icon is hidden when idle). */
  cloudCheck: svg(CLOUD + '<path d="m9 15 2 2 4-4"/>'),
  /** Syncing: cloud with circular arrows; blinks while a sync runs. */
  cloudSync: svg(
    CLOUD +
      '<path d="M10 14.5a2.5 2.5 0 0 1 4.33-1"/>' +
      '<path d="M14.6 13.6v1.6H13"/>' +
      '<path d="M14 17.5a2.5 2.5 0 0 1-4.33 1"/>' +
      '<path d="M9.4 18.4v-1.6H11"/>',
  ),
  /** Pending uploads: up arrow with count badge. */
  up: svg('<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>'),
  /** Conflict: warning triangle with count badge. */
  warn: svg(
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/>' +
      '<path d="M12 9v4"/><path d="M12 17h.01"/>',
  ),
  /** Error / paused: severed cloud. */
  off: svg(
    '<path d="M12 5v14"/><path d="m5 12 7 7 7-7"/><path d="M5 5h14"/>',
  ),
  /** Sync-now action button icon. */
  refresh: svg(
    '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>',
    12,
  ),
  /** Chevron for the collapsible trigger-source group. */
  chevron: svg('<path d="m6 9 6 6 6-6"/>', 13),
  /** Row remove ("x") for sync item / exclusion rows. */
  close: svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', 12),
};
