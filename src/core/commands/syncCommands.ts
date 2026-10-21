import * as vscode from "vscode";
import type { ConfigSyncService } from "../../services/sync/ConfigSyncService";

export interface SyncCommandDependencies {
  configSyncService: ConfigSyncService | undefined;
}

/** Registers the WebDAV config sync commands. */
export function registerSyncCommands(
  deps: SyncCommandDependencies,
): vscode.Disposable[] {
  const syncNowCommand = vscode.commands.registerCommand(
    "opencode-cli-sidebar.webdavSyncNow",
    () => {
      void deps.configSyncService?.syncNow();
    },
  );
  return [syncNowCommand];
}
