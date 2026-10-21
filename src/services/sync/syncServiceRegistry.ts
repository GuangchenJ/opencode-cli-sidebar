import type { ConfigSyncService } from "./ConfigSyncService";

/**
 * Active ConfigSyncService handle. TerminalProvider constructs MessageRouter
 * internally, so the router resolves the sync service through this module
 * instead of a constructor parameter; ExtensionLifecycle publishes the
 * instance right after activation.
 */
let activeSyncService: ConfigSyncService | undefined;

export function setActiveConfigSyncService(
  service: ConfigSyncService | undefined,
): void {
  activeSyncService = service;
}

export function getActiveConfigSyncService(): ConfigSyncService | undefined {
  return activeSyncService;
}
