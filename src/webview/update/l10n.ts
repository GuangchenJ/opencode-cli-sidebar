/**
 * OpenCode self-update UI strings.
 *
 * Evaluated on the extension host (same pattern as terminal/toolbar.ts) and
 * injected into the webview document as `window.__OC_UPDATE_L10N__` by
 * terminal/html.ts. The webview module reads it with English fallbacks.
 *
 * NOTE: zh-CN translations for these keys must be added to
 * l10n/bundle.l10n.zh-cn.json (host packaging owns that file).
 */
import { l10n } from "../../i18n";

export const openCodeUpdateL10nStrings: Record<string, string> = {
  // Pill (version entry) states
  updateLabel: l10n.t('Install OpenCode'),
  viewProgressLabel: l10n.t('View install progress'),
  updateAvailableTooltip: l10n.t(
    'OpenCode update available: latest {0}',
  ),
  updatingTooltip: l10n.t('Installing OpenCode, click to view progress'),
  failedRetryTooltip: l10n.t('Update did not finish. Click to try again'),
  pillChangelogTooltip: l10n.t("View the current version's changelog"),
  installLabel: l10n.t('Install'),
  installTooltip: l10n.t(
    'OpenCode CLI is not installed. Click to choose an install method.',
  ),

  // Missing-CLI install confirmation dialog
  installPromptTitle: l10n.t('Install OpenCode CLI'),
  installPromptBody: l10n.t(
    'OpenCode CLI was not found on this machine. Install it now?',
  ),
  notNowLabel: l10n.t('Not now'),
  redetectLabel: l10n.t('Re-detect'),
  redetectFailed: l10n.t(
    'OpenCode CLI still not detected. Re-detect or choose an install method.',
  ),

  // Method popover
  installPopoverTitle: l10n.t('Install OpenCode CLI'),
  updatePopoverTitle: l10n.t('Update OpenCode CLI to {0}'),
  changelogLabel: l10n.t('Changelog'),
  changelogCopy: l10n.t('Copy changelog'),
  changelogSend: l10n.t('Send to OpenCode'),
  changelogSentLabel: l10n.t('Sent'),
  changelogSendPrompt: l10n.t(
    'The above is the OpenCode {0} changelog. Please summarize it.',
  ),
  changelogRestarting: l10n.t('Session is restarting…'),
  changelogLoading: l10n.t('Fetching changelog…'),
  changelogFailed: l10n.t('Changelog is unavailable for this version.'),
  changelogOpenInBrowser: l10n.t('Open in browser'),
  changelogCheck: l10n.t('Check for new version'),
  changelogUpToDate: l10n.t('Already on the latest version.'),
  changelogCheckFailed: l10n.t('Check failed. Try again later.'),
  restartWithChangelog: l10n.t('Restart and view changelog'),
  hintConfirm: l10n.t('Enter to confirm'),
  hintCancel: l10n.t('Esc to cancel'),
  hintMove: l10n.t('Up and down to switch'),
  cancelLabel: l10n.t('Cancel'),
  methodDetected: l10n.t('Detected install method'),
  methodLastUsed: l10n.t('Last used'),

  // Method one-line explanations
  descCurl: l10n.t('Download and run the official install script'),
  descNpm: l10n.t('Install via the npm global package'),
  descPnpm: l10n.t('Install via the pnpm global package'),
  descBun: l10n.t('Install via the bun global package'),
  descYarn: l10n.t('Install via the yarn global package'),
  descVp: l10n.t('Install via the vp tool'),
  descBrew: l10n.t('Install via Homebrew'),
  descScoop: l10n.t('Install via Scoop'),
  descChoco: l10n.t('Install via Chocolatey'),

  // Progress / steps (ids aligned with OpenCodeUpdateService)
  progressTitle: l10n.t('Installing OpenCode'),
  stepPrepareTarget: l10n.t('Resolve latest version'),
  stepPrepareLocal: l10n.t('Read installed version'),
  stepExecute: l10n.t('Downloading and installing'),
  stepReshim: l10n.t('Sync nvm shim'),
  stepVerify: l10n.t('Verify version'),
  stepRemediateTrust: l10n.t('Apply nvm trust setting'),
  stepRemediateReshim: l10n.t('Run nvm reshim'),
  stepInstalling: l10n.t('Install OpenCode CLI'),

  // Success card
  successTitle: l10n.t('OpenCode {0} installed.'),
  successMessage: l10n.t('Restart the terminal now?'),
  sessionAutoStarted: l10n.t('OpenCode session started automatically.'),
  restartNow: l10n.t('Restart now'),
  later: l10n.t('Later'),

  // nvm manual-fallback card / abandon
  blockedTitle: l10n.t('npm install blocked by nvm security policy'),
  abandonUpdate: l10n.t('Abandon install'),
  remediateFailed: l10n.t(
    'Automatic fix did not succeed. Run the following commands in the terminal, then start the install again.',
  ),
  abandonedHint: l10n.t('Install abandoned'),
  gotIt: l10n.t('Got it'),

  // Verify failure / log drawer
  verifyFailedTitle: l10n.t('Install did not take effect, version is still {0}'),
  viewLog: l10n.t('View log'),
  logTitle: l10n.t('Install log'),

  // Copy feedback
  copy: l10n.t('Copy'),
  copied: l10n.t('Copied'),
  copyFailed: l10n.t('Copy failed'),

  // Manual check transients
  checkingUpdates: l10n.t('Checking for updates…'),

  // Misc
  closeLabel: l10n.t('Close'),
};
