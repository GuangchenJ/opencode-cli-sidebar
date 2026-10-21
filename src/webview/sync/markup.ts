/** Host-side markup entry for the WebDAV sync UI. */
import { renderSyncShell } from "./shell";
import { syncShellStrings } from "./l10n";

/** Static tooltip + panel shell; rendered once into the webview body. */
export function renderSyncUi(): string {
  return renderSyncShell(syncShellStrings);
}
