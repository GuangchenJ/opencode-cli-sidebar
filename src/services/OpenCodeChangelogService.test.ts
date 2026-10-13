import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  changelogAnchorId,
  changelogPageUrl,
  extractReleaseHtml,
  OpenCodeChangelogService,
  sanitizeChangelogHtml,
  type OpenCodeChangelogStore,
} from "./OpenCodeChangelogService";

const logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

function article(
  version: string,
  date: string,
  title: string,
): string {
  const id = changelogAnchorId(version);
  return (
    `<article class="release" id="${id}"><header><h2><a href="#${id}">${version}</a></h2>` +
    `<time datetime="${date}">${date}</time></header>` +
    `<section class="highlights"><h3 class="label">Highlights</h3><ul>` +
    `<li><p class="title">${title}</p><p>Description with <a href="https://github.com/anomalyco/opencode/pull/1">#1</a></p></li>` +
    `</ul></section>` +
    `<div class="sections"><details class="section" open><summary><span class="label">Core</span></summary>` +
    `<div class="markdown"><h4>Improvements</h4><ul><li>Did a thing.</li></ul></div></details></div>` +
    `</article>`
  );
}

const FIXTURE_PAGE =
  "<html><body><main>" +
  article("2.0.28", "2026-10-13", "Per-Project Auto-Accept") +
  article("2.0.27", "2026-10-12", "Built-In Worktree Tools") +
  "</main></body></html>";

interface MemoryStore extends OpenCodeChangelogStore {
  data: Map<string, unknown>;
}

function createStore(): MemoryStore {
  const data = new Map<string, unknown>();
  return {
    get: vi.fn(
      <T>(key: string): T | undefined => data.get(key) as T | undefined,
    ),
    update: vi.fn(async (key: string, value: unknown): Promise<void> => {
      data.set(key, value);
    }),
    data,
  };
}

function htmlResponse(body: string, ok = true, status = 200): Response {
  return { ok, status, text: async () => body } as unknown as Response;
}

describe("OpenCodeChangelogService", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("changelogAnchorId / changelogPageUrl", () => {
    it("maps a version to its page anchor", () => {
      expect(changelogAnchorId("2.0.28")).toBe("v2-0-28");
      expect(changelogPageUrl("2.0.28")).toBe(
        "https://opencode.ai/changelog#v2-0-28",
      );
      expect(changelogPageUrl()).toBe("https://opencode.ai/changelog");
    });
  });

  describe("sanitizeChangelogHtml", () => {
    it("strips scripts, inline handlers, and javascript: URLs", () => {
      const dirty =
        '<p onclick="evil()">keep</p><script>alert(1)</script>' +
        '<a href="javascript:evil()">link</a>';
      const clean = sanitizeChangelogHtml(dirty);
      expect(clean).toContain("keep");
      expect(clean).not.toContain("script");
      expect(clean).not.toContain("onclick");
      expect(clean).not.toContain("javascript:");
    });
  });

  describe("extractReleaseHtml", () => {
    it("extracts one version without its header or sibling releases", () => {
      const entry = extractReleaseHtml(FIXTURE_PAGE, "2.0.28");
      expect(entry).toBeDefined();
      expect(entry?.date).toBe("2026-10-13");
      expect(entry?.html).toContain("Per-Project Auto-Accept");
      expect(entry?.html).toContain("<h4>Improvements</h4>");
      expect(entry?.html).not.toContain("<header>");
      expect(entry?.html).not.toContain("2.0.28");
      expect(entry?.html).not.toContain("Worktree");
    });

    it("returns undefined for a version missing from the page", () => {
      expect(extractReleaseHtml(FIXTURE_PAGE, "2.0.20")).toBeUndefined();
    });

    it("returns undefined for a broken article block", () => {
      const broken = '<article class="release" id="v2-0-28"><p>no end';
      expect(extractReleaseHtml(broken, "2.0.28")).toBeUndefined();
    });
  });

  describe("fetchChangelog", () => {
    it("fetches, parses, and caches one version permanently", async () => {
      fetchMock.mockResolvedValue(htmlResponse(FIXTURE_PAGE));
      const store = createStore();
      const service = new OpenCodeChangelogService(store, { logger });

      const first = await service.fetchChangelog("2.0.28");

      expect(first.ok).toBe(true);
      if (first.ok) {
        expect(first.date).toBe("2026-10-13");
        expect(first.html).toContain("Per-Project Auto-Accept");
      }
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(store.update).toHaveBeenCalledWith("opencodeChangelog.2.0.28", {
        version: "2.0.28",
        date: "2026-10-13",
        html: expect.any(String),
      });

      // Cache hit: no second fetch.
      const second = await service.fetchChangelog("2.0.28");
      expect(second.ok).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("dedupes concurrent requests onto one fetch", async () => {
      fetchMock.mockResolvedValue(htmlResponse(FIXTURE_PAGE));
      const service = new OpenCodeChangelogService(createStore(), { logger });

      const [a, b] = await Promise.all([
        service.fetchChangelog("2.0.27"),
        service.fetchChangelog("2.0.27"),
      ]);

      expect(a.ok).toBe(true);
      expect(b.ok).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("does not cache failures so a later call retries", async () => {
      fetchMock
        .mockResolvedValueOnce(htmlResponse(FIXTURE_PAGE.replace(
          'id="v2-0-27"',
          'id="v2-0-99"',
        )))
        .mockResolvedValueOnce(htmlResponse(FIXTURE_PAGE));
      const store = createStore();
      const service = new OpenCodeChangelogService(store, { logger });

      const missing = await service.fetchChangelog("2.0.27");
      expect(missing.ok).toBe(false);

      const later = await service.fetchChangelog("2.0.27");
      expect(later.ok).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("returns ok:false on HTTP errors and network failures", async () => {
      fetchMock.mockResolvedValueOnce(htmlResponse("", false, 500));
      const store = createStore();
      const service = new OpenCodeChangelogService(store, { logger });

      const httpError = await service.fetchChangelog("2.0.28");
      expect(httpError.ok).toBe(false);

      fetchMock.mockRejectedValueOnce(new Error("network down"));
      const netError = await service.fetchChangelog("2.0.28");
      expect(netError.ok).toBe(false);
    });

    it("rejects non-release versions without touching the network", async () => {
      const service = new OpenCodeChangelogService(createStore(), { logger });

      expect((await service.fetchChangelog("local")).ok).toBe(false);
      expect((await service.fetchChangelog("../evil")).ok).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
