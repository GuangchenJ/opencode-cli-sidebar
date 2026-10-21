import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { SyncManifest, hashContent, syncStorageDir } from "./SyncManifest";

describe("SyncManifest", () => {
  let storageDir: string;

  beforeEach(() => {
    storageDir = fs.mkdtempSync(path.join(os.tmpdir(), "oc-manifest-"));
  });

  it("normalizes line endings and strips the BOM before hashing", () => {
    const crlf = Buffer.from("\uFEFFa\r\nb\r\n", "utf8");
    const lf = Buffer.from("a\nb\n", "utf8");
    expect(hashContent(crlf)).toBe(hashContent(lf));
    expect(hashContent(lf)).toHaveLength(64);
    expect(hashContent(Buffer.from("x", "utf8"))).not.toBe(
      hashContent(Buffer.from("y", "utf8")),
    );
  });

  it("persists entries under <globalStorage>/sync/manifest.json", async () => {
    const manifest = new SyncManifest(storageDir);
    await manifest.load();
    manifest.set("opencode.json", {
      localHash: "h1",
      remoteEtag: '"e1"',
      remoteHash: "h1",
      baselineHash: "h1",
      lastSyncAt: 123,
    });
    manifest.set("cli.json", {
      localHash: "h2",
      remoteEtag: null,
      remoteHash: "h2",
      baselineHash: "h2",
      lastSyncAt: 456,
    });
    await manifest.save();

    const filePath = path.join(syncStorageDir(storageDir), "manifest.json");
    expect(fs.existsSync(filePath)).toBe(true);

    const reloaded = new SyncManifest(storageDir);
    await reloaded.load();
    expect(reloaded.get("opencode.json")).toEqual({
      localHash: "h1",
      remoteEtag: '"e1"',
      remoteHash: "h1",
      baselineHash: "h1",
      lastSyncAt: 123,
    });
    expect(reloaded.paths().sort()).toEqual(["cli.json", "opencode.json"]);

    reloaded.remove("cli.json");
    expect(reloaded.get("cli.json")).toBeUndefined();
    await reloaded.save();

    const third = new SyncManifest(storageDir);
    await third.load();
    expect(third.paths()).toEqual(["opencode.json"]);
  });

  it("tolerates a missing or corrupt manifest file", async () => {
    fs.mkdirSync(syncStorageDir(storageDir), { recursive: true });
    fs.writeFileSync(
      path.join(syncStorageDir(storageDir), "manifest.json"),
      "{not json",
      "utf8",
    );
    const manifest = new SyncManifest(storageDir);
    await manifest.load();
    expect(manifest.paths()).toEqual([]);
  });
});
