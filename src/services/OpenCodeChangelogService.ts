import { OutputChannelService } from "./OutputChannelService";

/**
 * Fetches per-version release notes for the OpenCode v2 CLI from the
 * official changelog page. The page is the only source carrying v2
 * release notes: the GitHub release bodies for v2 are placeholders and
 * the changelog.json endpoint currently proxies the v1-dominated GitHub
 * release list. Every release entry is a static `<article id="v2-0-28">`
 * block, so a single fetch plus string slicing extracts one version.
 */

const CHANGELOG_PAGE_URL = "https://opencode.ai/changelog";
const CHANGELOG_FETCH_TIMEOUT_MS = 10_000;
const CACHE_KEY_PREFIX = "opencodeChangelog.";

/** Release notes are immutable, so a successful fetch is cached forever. */
export interface OpenCodeChangelogEntry {
  version: string;
  date?: string;
  html: string;
}

export type OpenCodeChangelogResult =
  | ({ ok: true } & OpenCodeChangelogEntry)
  | { ok: false; version: string; error: string };

/** Minimal Memento-shaped persistence for changelog entries. */
export interface OpenCodeChangelogStore {
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): Thenable<void>;
}

export interface OpenCodeChangelogServiceOptions {
  logger?: Pick<
    OutputChannelService,
    "debug" | "info" | "warn" | "error"
  >;
}

/** Release anchors encode the version with dashes: 2.0.28 -> v2-0-28. */
export function changelogAnchorId(version: string): string {
  return `v${version.replace(/\./g, "-")}`;
}

/** Changelog page URL, with the per-version anchor when a version is known. */
export function changelogPageUrl(version?: string): string {
  return version
    ? `${CHANGELOG_PAGE_URL}#${changelogAnchorId(version)}`
    : CHANGELOG_PAGE_URL;
}

/**
 * Defense-in-depth cleanup of the official HTML. The webview CSP already
 * blocks injected scripts (nonce-only script-src), and anchors are
 * intercepted at click time, so this only needs to remove the obvious
 * hazards in case the upstream page is ever compromised.
 */
export function sanitizeChangelogHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "#blocked:");
}

/**
 * Extracts one release entry from the changelog page HTML. Returns the
 * article's inner HTML without its header (the dialog title carries the
 * version) plus the release date, or undefined when the version is not
 * on the page (the page only keeps the most recent releases).
 */
export function extractReleaseHtml(
  pageHtml: string,
  version: string,
): { html: string; date?: string } | undefined {
  const anchor = `id="${changelogAnchorId(version)}"`;
  const anchorAt = pageHtml.indexOf(anchor);
  if (anchorAt === -1) {
    return undefined;
  }
  const start = pageHtml.lastIndexOf("<article", anchorAt);
  const end = pageHtml.indexOf("</article>", anchorAt);
  if (start === -1 || end === -1) {
    return undefined;
  }
  const article = pageHtml.slice(start, end + "</article>".length);
  const date = article.match(/datetime="([^"]+)"/)?.[1];
  const inner = article
    .replace(/<article[^>]*>/i, "")
    .replace(/<\/article>\s*$/i, "")
    // Drop the version header: the dialog title already shows it.
    .replace(/<header[\s\S]*?<\/header>/i, "")
    .trim();
  return { html: sanitizeChangelogHtml(inner), date };
}

export class OpenCodeChangelogService {
  private readonly store: OpenCodeChangelogStore;
  private readonly logger: Pick<
    OutputChannelService,
    "debug" | "info" | "warn" | "error"
  >;
  private readonly inFlight = new Map<string, Promise<OpenCodeChangelogResult>>();

  public constructor(
    store: OpenCodeChangelogStore,
    { logger = OutputChannelService.getInstance() }: OpenCodeChangelogServiceOptions = {},
  ) {
    this.store = store;
    this.logger = logger;
  }

  /**
   * Resolves the release notes for one version: permanent cache first,
   * then one page fetch shared by concurrent callers. Never throws;
   * failures return `{ ok: false, error }` and are not cached, so a
   * later call retries (e.g. after the page adds the version).
   */
  public async fetchChangelog(version: string): Promise<OpenCodeChangelogResult> {
    if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
      // Dev builds ("local") and garbage never hit the network.
      return { ok: false, version, error: "invalid version" };
    }
    const cached = this.store.get<OpenCodeChangelogEntry>(
      CACHE_KEY_PREFIX + version,
    );
    if (cached) {
      return { ok: true, ...cached };
    }
    const pending = this.inFlight.get(version);
    if (pending) {
      return pending;
    }
    const task = this.fetchFromPage(version);
    this.inFlight.set(version, task);
    try {
      return await task;
    } finally {
      if (this.inFlight.get(version) === task) {
        this.inFlight.delete(version);
      }
    }
  }

  private async fetchFromPage(
    version: string,
  ): Promise<OpenCodeChangelogResult> {
    try {
      const response = await fetch(CHANGELOG_PAGE_URL, {
        signal: AbortSignal.timeout(CHANGELOG_FETCH_TIMEOUT_MS),
      });
      if (!response.ok) {
        return {
          ok: false,
          version,
          error: `changelog page returned ${response.status}`,
        };
      }
      const page = await response.text();
      const entry = extractReleaseHtml(page, version);
      if (!entry) {
        return {
          ok: false,
          version,
          error: "version not found on the changelog page",
        };
      }
      const resolved: OpenCodeChangelogEntry = {
        version,
        date: entry.date,
        html: entry.html,
      };
      await this.store.update(CACHE_KEY_PREFIX + version, resolved);
      this.logger.debug(
        `[OpenCodeChangelogService] cached changelog for ${version} (${entry.html.length} chars)`,
      );
      return { ok: true, ...resolved };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.debug(
        `[OpenCodeChangelogService] changelog fetch failed for ${version}: ${message}`,
      );
      return { ok: false, version, error: message };
    }
  }
}
