/**
 * Sync popover (L1): anchored status bubble with quick actions.
 * Opens from the toolbar status icon; closes on outside click,
 * re-click, or Esc (panel closes first when open).
 */
import { SYNC_ICONS } from "./icons";
import type { SyncIconInfo, SyncUiState } from "./state";
import { st } from "./strings";
import { syncNowButtonLabel } from "./panes";

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

let popOpen = false;

export function isPopoverOpen(): boolean {
  return popOpen;
}

export function openSyncPopover(): void {
  popOpen = true;
  el("dav-pop").classList.remove("hidden");
  el("btn-dav-sync-status").setAttribute("aria-expanded", "true");
}

export function closeSyncPopover(): void {
  popOpen = false;
  const pop = document.getElementById("dav-pop");
  if (pop) {
    pop.classList.add("hidden");
  }
  const anchor = document.getElementById("btn-dav-sync-status");
  if (anchor) {
    anchor.setAttribute("aria-expanded", "false");
  }
}

/** Status line + icon + action visibility for the popover. */
function statusContent(
  state: SyncUiState,
  icon: SyncIconInfo | null,
): { text: string; color: string; iconHtml: string; blink: boolean } {
  const warn = "var(--vscode-errorForeground, #f87171)";
  const blue = "var(--vscode-focusBorder, #0078d4)";
  const dim = "var(--vscode-descriptionForeground, #8a8a8a)";
  const yellow = "var(--vscode-editorWarning-foreground, #cca700)";
  if (state.state === "unconfigured") {
    return { text: st.stUnconfigured, color: dim, iconHtml: SYNC_ICONS.cloudCheck, blink: false };
  }
  if (icon?.kind === "conflict") {
    return { text: st.stConflict(state.conflictCount), color: warn, iconHtml: SYNC_ICONS.warn, blink: false };
  }
  if (icon?.kind === "paused") {
    return { text: st.iconPaused, color: warn, iconHtml: SYNC_ICONS.off, blink: false };
  }
  if (icon?.kind === "error") {
    return { text: st.stError, color: warn, iconHtml: SYNC_ICONS.off, blink: false };
  }
  if (icon?.kind === "syncing" || state.state === "syncing") {
    return { text: st.stSyncing, color: blue, iconHtml: SYNC_ICONS.cloudSync, blink: true };
  }
  if (icon?.kind === "pending") {
    return { text: st.stPending(state.pendingCount), color: yellow, iconHtml: SYNC_ICONS.up, blink: false };
  }
  return { text: st.stIdle, color: dim, iconHtml: SYNC_ICONS.cloudCheck, blink: false };
}

function subLine(state: SyncUiState): string {
  if (state.state === "unconfigured") {
    return "";
  }
  const last = st.lastSync(state.lastSyncLabel ?? st.neverSynced);
  const auto = state.settings?.autoSync;
  const mode = !auto ? "" : auto.enabled ? st.autoOn : st.manualMode;
  return mode ? `${last} · ${mode}` : last;
}

/** Status line content shared with the toolbar icon hover tooltip. */
export function popoverStatus(state: SyncUiState): {
  text: string;
  color: string;
  iconHtml: string;
} {
  const content = statusContent(state, popoverIconFor(state));
  return {
    text: content.text,
    color: content.color,
    iconHtml: content.iconHtml,
  };
}

export function renderPopover(state: SyncUiState): void {
  const icon = popoverIconFor(state);
  const content = statusContent(state, icon);
  const ic = el("dav-pop-ic");
  ic.innerHTML = content.blink
    ? `<span class="dav-blink">${content.iconHtml}</span>`
    : content.iconHtml;
  ic.style.color = content.color;
  el("dav-pop-text").textContent = content.text;
  el("dav-pop-sub").textContent = subLine(state);
  el("dav-pop-paused").hidden = !state.autoSyncPaused;
  el("dav-pop-paused").textContent = st.pausedBadge;

  const syncing = state.state === "syncing";
  const syncBtn = el<HTMLButtonElement>("dav-pop-sync");
  syncBtn.disabled = syncing;
  syncBtn.innerHTML = syncNowButtonLabel();
  syncBtn.classList.toggle("hidden", state.state === "unconfigured");

  const conflictBtn = el<HTMLButtonElement>("dav-pop-conflict");
  const hasConflicts = state.conflictCount > 0;
  conflictBtn.classList.toggle("hidden", !hasConflicts);
  conflictBtn.textContent = st.actResolve(state.conflictCount);
}

/** Icon info used for the popover; visible even when the toolbar icon is
 * switched off, so the popover still renders a coherent status. */
function popoverIconFor(state: SyncUiState): SyncIconInfo | null {
  if (state.conflictCount > 0) {
    return { kind: "conflict", count: state.conflictCount };
  }
  if (state.autoSyncPaused) {
    return { kind: "paused" };
  }
  if (state.state === "error") {
    return { kind: "error" };
  }
  if (state.state === "syncing") {
    return { kind: "syncing" };
  }
  if (state.pendingCount > 0) {
    return { kind: "pending", count: state.pendingCount };
  }
  return null;
}

/** Wire popover events; called from initSyncUi. */
export function initPopover(handlers: {
  onSyncNow: () => void;
  onOpenPanel: () => void;
  onOpenConflicts: () => void;
}): void {
  const anchor = el("btn-dav-sync-status");
  anchor.addEventListener("click", (event) => {
    event.stopPropagation();
    if (popOpen) {
      closeSyncPopover();
    } else {
      openSyncPopover();
    }
  });

  el("dav-pop-sync").addEventListener("click", handlers.onSyncNow);
  el("dav-pop-panel").addEventListener("click", handlers.onOpenPanel);
  el("dav-pop-conflict").addEventListener("click", handlers.onOpenConflicts);

  document.addEventListener("click", (event) => {
    if (!popOpen) {
      return;
    }
    const target = event.target as Node;
    if (
      !document.getElementById("dav-pop")?.contains(target) &&
      !anchor.contains(target)
    ) {
      closeSyncPopover();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }
    const overlay = document.getElementById("dav-overlay");
    if (overlay && !overlay.classList.contains("hidden")) {
      overlay.classList.add("hidden");
      return;
    }
    if (popOpen) {
      closeSyncPopover();
    }
  });
}
