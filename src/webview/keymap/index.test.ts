// @vitest-environment jsdom

import { describe, beforeAll, beforeEach, expect, it, vi } from "vitest";
import {
  eventToChord,
  initKeymapUi,
  matchesKeyText,
  normalizeChordText,
  normalizeSearchQuery,
  openKeymapModal,
} from "./index";

const mockPostMessage = vi.hoisted(() => vi.fn());

vi.mock("../shared/vscode-api", () => ({
  postMessage: mockPostMessage,
}));

/**
 * 复刻 markup.ts 中与搜索相关的 DOM 契约（markup.ts 会引入扩展宿主侧的
 * i18n/vscode，浏览器测试无法走真实 markup，故以最小镜像替代）。
 */
const SEARCH_DOM_FIXTURE = `
<div class="km-overlay hidden" id="km-overlay">
  <div class="km-modal">
    <div class="km-main">
      <nav class="km-side-nav" id="km-side-nav"></nav>
      <div class="km-content">
        <div class="km-tools">
          <div class="km-search">
            <input type="search" id="km-search" placeholder="Search commands, descriptions, or keys…" autocomplete="off" />
            <div class="km-search-actions">
              <button type="button" class="km-search-btn" id="km-search-record" aria-pressed="false">
                <span class="capture-dot" aria-hidden="true"></span>
              </button>
              <button type="button" class="km-search-btn hidden" id="km-search-clear"></button>
            </div>
          </div>
        </div>
        <div class="km-list" id="km-list"></div>
      </div>
    </div>
    <span class="km-stats" id="km-stats"></span>
  </div>
</div>
<div class="km-confirm-overlay hidden" id="km-confirm-overlay"></div>`;

interface KeydownInit extends KeyboardEventInit {
  code?: string;
  keyCode?: number;
}

function keydown(init: KeydownInit): KeyboardEvent {
  const { code, keyCode, ...rest } = init;
  const event = new KeyboardEvent("keydown", rest);
  if (code !== undefined) {
    Object.defineProperty(event, "code", { value: code });
  }
  if (keyCode !== undefined) {
    Object.defineProperty(event, "keyCode", { value: keyCode });
  }
  return event;
}

/**
 * jsdom 的 dispatchEvent 会在派发开始时把 impl 上的 isTrusted 重置为 false，
 * 且实例上的 isTrusted 是不可配置访问器。全局 keydown 处理器只录制 isTrusted
 * 的物理按键，因此先注册一个监听把 impl.isTrusted 翻回 true，再注册被测逻辑。
 */
function installTrustedKeydownFlip(): void {
  document.addEventListener("keydown", (e) => {
    for (const sym of Object.getOwnPropertySymbols(e)) {
      const impl = (e as unknown as Record<symbol, unknown>)[sym];
      if (impl && typeof impl === "object" && "isTrusted" in impl) {
        (impl as { isTrusted: boolean }).isTrusted = true;
      }
    }
  });
}

describe("eventToChord", () => {
  it("captures plain modifier chords", () => {
    expect(
      eventToChord(keydown({ key: "1", code: "Digit1", ctrlKey: true })),
    ).toBe("ctrl+1");
    expect(
      eventToChord(keydown({ key: "x", code: "KeyX", ctrlKey: true })),
    ).toBe("ctrl+x");
    expect(
      eventToChord(keydown({ key: "1", code: "Digit1", altKey: true })),
    ).toBe("alt+1");
    expect(
      eventToChord(keydown({ key: "x", code: "KeyX", metaKey: true })),
    ).toBe("super+x");
  });

  it("prefers the physical key when e.key is mistranslated", () => {
    // 环境把 ctrl+1 的 key 报成 "Insert"（IME/转译层污染）时，仍按物理键 Digit1 记录
    expect(
      eventToChord(keydown({ key: "Insert", code: "Digit1", ctrlKey: true })),
    ).toBe("ctrl+1");
    expect(
      eventToChord(keydown({ key: "Delete", code: "KeyA", ctrlKey: true })),
    ).toBe("ctrl+a");
  });

  it("keeps genuine insert and numpad-insert as insert", () => {
    expect(
      eventToChord(keydown({ key: "Insert", code: "Insert", shiftKey: true })),
    ).toBe("shift+insert");
    // NumLock 关闭时小键盘 0 上报 key="Insert"，语义按 Insert 保留
    expect(
      eventToChord(keydown({ key: "Insert", code: "Numpad0", shiftKey: true })),
    ).toBe("shift+insert");
  });

  it("resolves IME process events via the physical code", () => {
    expect(
      eventToChord(
        keydown({
          key: "Process",
          code: "Digit1",
          ctrlKey: true,
          keyCode: 229,
        }),
      ),
    ).toBe("ctrl+1");
  });

  it("uses the physical key when ctrl produces a control character", () => {
    expect(
      eventToChord(keydown({ key: "\u0001", code: "KeyA", ctrlKey: true })),
    ).toBe("ctrl+a");
  });

  it("records printable characters according to the layout", () => {
    // shift+1 在美式布局下是 "!"，沿用布局字符
    expect(
      eventToChord(keydown({ key: "!", code: "Digit1", shiftKey: true })),
    ).toBe("shift+!");
    expect(eventToChord(keydown({ key: "a", code: "KeyA" }))).toBe("a");
  });

  it("maps named keys to OpenCode/tcell names", () => {
    expect(eventToChord(keydown({ key: "Enter", code: "Enter" }))).toBe(
      "return",
    );
    expect(eventToChord(keydown({ key: "Enter", code: "NumpadEnter" }))).toBe(
      "kpenter",
    );
    expect(eventToChord(keydown({ key: " ", code: "Space" }))).toBe("space");
    expect(eventToChord(keydown({ key: "F5", code: "F5" }))).toBe("f5");
    expect(eventToChord(keydown({ key: "ArrowLeft", code: "ArrowLeft" }))).toBe(
      "left",
    );
    expect(
      eventToChord(keydown({ key: "Escape", code: "Escape" })),
    ).toBe("escape");
  });

  it("ignores modifier-only and unidentifiable keys", () => {
    expect(eventToChord(keydown({ key: "Control", ctrlKey: true }))).toBeNull();
    expect(eventToChord(keydown({ key: "Shift", shiftKey: true }))).toBeNull();
    expect(
      eventToChord(keydown({ key: "Unidentified", code: "" })),
    ).toBeNull();
    expect(eventToChord(keydown({ key: "Dead", code: "" }))).toBeNull();
  });
});

describe("normalizeChordText", () => {
  it("normalizes alias keys per chord and per modifier part", () => {
    expect(normalizeChordText("enter,ctrl+k")).toBe("return,ctrl+k");
    expect(normalizeChordText("ctrl+esc")).toBe("ctrl+escape");
    expect(normalizeChordText("<leader>q,pgup")).toBe("<leader>q,pageup");
  });

  it("keeps plain chords and empty/none values as-is", () => {
    expect(normalizeChordText("ctrl+x")).toBe("ctrl+x");
    expect(normalizeChordText("none")).toBe("none");
    expect(normalizeChordText("")).toBe("");
  });
});

describe("normalizeSearchQuery", () => {
  it("normalizes single-chord queries in both directions", () => {
    expect(normalizeSearchQuery("Enter")).toBe("return");
    expect(normalizeSearchQuery("ctrl+enter")).toBe("ctrl+return");
    expect(normalizeSearchQuery("Esc")).toBe("escape");
    expect(normalizeSearchQuery("Ctrl+K")).toBe("ctrl+k");
    expect(normalizeSearchQuery("<leader>q")).toBe("<leader>q");
  });

  it("leaves free-text and multi-chord queries untouched", () => {
    expect(normalizeSearchQuery("ctrl+k session")).toBe("ctrl+k session");
    expect(normalizeSearchQuery("redo input")).toBe("redo input");
    expect(normalizeSearchQuery(" redo ")).toBe("redo");
  });
});

describe("matchesKeyText", () => {
  it("matches recorded chords against alias storage", () => {
    // 录制 Enter 得到 "return"，但存储可能是别名 "enter"
    expect(matchesKeyText("enter", "ctrl+j", "return")).toBe(true);
    expect(matchesKeyText("ctrl+enter", "none", "ctrl+return")).toBe(true);
    expect(matchesKeyText("<leader>q", "none", "<leader>q")).toBe(true);
    expect(matchesKeyText("pgup", "none", "pgup")).toBe(true);
  });

  it("keeps raw substring matching for partial input", () => {
    expect(matchesKeyText("enter", "none", "ente")).toBe(true);
    expect(matchesKeyText("pageup", "none", "page")).toBe(true);
  });

  it("rejects unrelated queries", () => {
    expect(matchesKeyText("ctrl+x", "none", "ctrl+y")).toBe(false);
    expect(matchesKeyText("return", "none", "ctrl+return")).toBe(false);
  });
});

describe("search recording", () => {
  let input: HTMLInputElement;
  let recordBtn: HTMLButtonElement;
  let clearBtn: HTMLButtonElement;

  beforeAll(() => {
    document.body.innerHTML = SEARCH_DOM_FIXTURE;
    installTrustedKeydownFlip();
    initKeymapUi();
    input = document.querySelector("#km-search") as HTMLInputElement;
    recordBtn = document.querySelector(
      "#km-search-record",
    ) as HTMLButtonElement;
    clearBtn = document.querySelector("#km-search-clear") as HTMLButtonElement;
  });

  beforeEach(() => {
    openKeymapModal();
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });

  const type = (value: string): void => {
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const press = (init: KeydownInit): void => {
    document.dispatchEvent(keydown(init));
  };

  it("toggles recording from the record button", () => {
    recordBtn.click();
    expect(recordBtn.getAttribute("aria-pressed")).toBe("true");
    expect(input.readOnly).toBe(true);
    expect(input.placeholder).toBe("Press keys to search…");
    recordBtn.click();
    expect(recordBtn.getAttribute("aria-pressed")).toBe("false");
    expect(input.readOnly).toBe(false);
    expect(input.value).toBe("");
  });

  it("records a chord into the search box and exits recording", () => {
    recordBtn.click();
    press({ key: "k", code: "KeyK", ctrlKey: true });
    expect(input.value).toBe("ctrl+k");
    expect(recordBtn.getAttribute("aria-pressed")).toBe("false");
    expect(input.readOnly).toBe(false);
    expect(clearBtn.classList.contains("hidden")).toBe(false);
  });

  it("ignores modifier-only keys while recording", () => {
    recordBtn.click();
    press({ key: "Control", ctrlKey: true });
    expect(recordBtn.getAttribute("aria-pressed")).toBe("true");
    press({ key: "Escape", code: "Escape" });
    expect(recordBtn.getAttribute("aria-pressed")).toBe("false");
  });

  it("Escape exits recording without clearing the query", () => {
    type("session");
    recordBtn.click();
    press({ key: "Escape", code: "Escape" });
    expect(input.value).toBe("session");
    expect(recordBtn.getAttribute("aria-pressed")).toBe("false");
  });

  it("Backspace clears the search and exits recording", () => {
    type("abc");
    recordBtn.click();
    press({ key: "Backspace", code: "Backspace" });
    expect(input.value).toBe("");
    expect(recordBtn.getAttribute("aria-pressed")).toBe("false");
    expect(clearBtn.classList.contains("hidden")).toBe(true);
  });

  it("records leader sequences and falls back to the bare chord on timeout", () => {
    vi.useFakeTimers();
    recordBtn.click();
    press({ key: "x", code: "KeyX", ctrlKey: true });
    expect(input.value).toBe("Ctrl + x …");
    expect(recordBtn.getAttribute("aria-pressed")).toBe("true");
    press({ key: "q", code: "KeyQ" });
    expect(input.value).toBe("<leader>q");
    expect(recordBtn.getAttribute("aria-pressed")).toBe("false");
    // 1.5s 内无后续键：leader 组合本身作为搜索词提交
    recordBtn.click();
    press({ key: "x", code: "KeyX", ctrlKey: true });
    vi.advanceTimersByTime(1500);
    expect(input.value).toBe("ctrl+x");
    expect(recordBtn.getAttribute("aria-pressed")).toBe("false");
    vi.useRealTimers();
  });

  it("clear button empties the search and exits recording", () => {
    type("abc");
    recordBtn.click();
    clearBtn.click();
    expect(input.value).toBe("");
    expect(recordBtn.getAttribute("aria-pressed")).toBe("false");
    expect(clearBtn.classList.contains("hidden")).toBe(true);
    expect(document.activeElement).toBe(input);
  });
});
