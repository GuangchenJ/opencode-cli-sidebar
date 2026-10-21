/**
 * Toolbar status-icon hover tooltip: a quiet one-line status preview
 * anchored under the icon, with a dismiss action that hides the status
 * icon until its kind changes.
 *
 * Opens after a short hover delay, bridges the anchor gap so the pointer
 * can reach the dismiss action, and closes on a grace-period mouseleave,
 * Escape, or when the panel opens.
 */
import type { SyncUiState } from "./state";
import { syncStatusLine } from "./status";

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

const OPEN_DELAY_MS = 400;
const CLOSE_GRACE_MS = 200;

let tipOpen = false;
let openTimer: ReturnType<typeof setTimeout> | null = null;
let closeTimer: ReturnType<typeof setTimeout> | null = null;

function cancelOpenTimer(): void {
  if (openTimer) {
    clearTimeout(openTimer);
    openTimer = null;
  }
}

function cancelCloseTimer(): void {
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
}

/** Fixed-position anchor under the icon; the shell renders outside the
 *  toolbar, so a CSS-anchored popup cannot be reused here. */
function openTip(): void {
  const anchor = document.getElementById("btn-dav-sync-status");
  const tip = document.getElementById("dav-sync-tip");
  if (!anchor || !tip || anchor.classList.contains("hidden")) {
    return;
  }
  cancelCloseTimer();
  const rect = anchor.getBoundingClientRect();
  tip.style.left = `${Math.max(6, Math.round(rect.left))}px`;
  tip.style.top = `${Math.round(rect.bottom + 6)}px`;
  tip.classList.remove("hidden");
  anchor.setAttribute("aria-describedby", "dav-sync-tip");
  tipOpen = true;
}

export function closeSyncTooltip(): void {
  cancelOpenTimer();
  cancelCloseTimer();
  const tip = document.getElementById("dav-sync-tip");
  if (tip) {
    tip.classList.add("hidden");
  }
  document
    .getElementById("btn-dav-sync-status")
    ?.removeAttribute("aria-describedby");
  tipOpen = false;
}

/** Refresh the status line from state; called on every sync render so a
 *  hover started before a delta still shows fresh text. */
export function updateSyncTooltip(state: SyncUiState): void {
  const ic = document.getElementById("dav-sync-tip-ic");
  const text = document.getElementById("dav-sync-tip-text");
  if (!ic || !text) {
    return;
  }
  const content = syncStatusLine(state);
  ic.innerHTML = content.iconHtml;
  ic.style.color = content.color;
  text.textContent = content.text;
}

/** Wire tooltip events; called from initSyncUi. */
export function initSyncTooltip(handlers: {
  onDismiss: () => void;
}): void {
  const anchor = el("btn-dav-sync-status");
  const tip = el("dav-sync-tip");

  const scheduleOpen = (): void => {
    cancelCloseTimer();
    if (tipOpen || openTimer) {
      return;
    }
    openTimer = setTimeout(() => {
      openTimer = null;
      openTip();
    }, OPEN_DELAY_MS);
  };
  const scheduleClose = (): void => {
    cancelOpenTimer();
    if (!tipOpen || closeTimer) {
      return;
    }
    closeTimer = setTimeout(() => {
      closeTimer = null;
      closeSyncTooltip();
    }, CLOSE_GRACE_MS);
  };

  anchor.addEventListener("mouseenter", scheduleOpen);
  anchor.addEventListener("mouseleave", scheduleClose);
  // Bridge: hovering the tooltip itself cancels the pending close so
  // the pointer can travel the gap to the actions.
  tip.addEventListener("mouseenter", cancelCloseTimer);
  tip.addEventListener("mouseleave", scheduleClose);
  // Clicking the icon opens the panel: the tooltip must never compete.
  anchor.addEventListener("click", closeSyncTooltip);

  el("dav-sync-tip-close").addEventListener("click", (event) => {
    event.stopPropagation();
    closeSyncTooltip();
    handlers.onDismiss();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && tipOpen) {
      closeSyncTooltip();
    }
  });
}
