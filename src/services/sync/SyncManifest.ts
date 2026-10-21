import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Sync manifest persisted at <globalStorage>/sync/manifest.json. Tracks the
 * last-agreed content state per file so the engine can run three-way
 * comparisons between local, remote and the synced baseline.
 */

export interface SyncManifestEntry {
  /** Local content hash at the last successful sync. */
  localHash: string;
  /** Remote ETag at the last successful sync; null on ETag-less servers. */
  remoteEtag: string | null;
  /** Remote content hash at the last successful sync. */
  remoteHash: string | null;
  /** Reference hash both sides agreed on at the last successful sync. */
  baselineHash: string | null;
  /** Epoch ms of the last successful sync of this file. */
  lastSyncAt: number;
}

export interface SyncManifestData {
  files: Record<string, SyncManifestEntry>;
}

/**
 * Content hash used by all comparisons: SHA-256 over normalized text where
 * a leading BOM is stripped and CRLF line endings become LF. Binary bytes
 * that survive the round trip unchanged hash identically on both sides.
 */
export function hashContent(content: Buffer): string {
  let text = content.toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }
  text = text.replace(/\r\n/g, "\n");
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

/** Directory that holds manifest.json plus conflict backups. */
export function syncStorageDir(globalStoragePath: string): string {
  return path.join(globalStoragePath, "sync");
}

export class SyncManifest {
  private data: SyncManifestData = { files: {} };
  private readonly filePath: string;
  private loaded = false;

  public constructor(globalStoragePath: string) {
    this.filePath = path.join(syncStorageDir(globalStoragePath), "manifest.json");
  }

  public async load(): Promise<void> {
    if (this.loaded) {
      return;
    }
    this.loaded = true;
    try {
      const raw = await fs.promises.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<SyncManifestData>;
      if (parsed && typeof parsed === "object" && parsed.files && typeof parsed.files === "object") {
        this.data = { files: parsed.files as Record<string, SyncManifestEntry> };
      }
    } catch {
      this.data = { files: {} };
    }
  }

  public get(relPath: string): SyncManifestEntry | undefined {
    return this.data.files[relPath];
  }

  public set(relPath: string, entry: SyncManifestEntry): void {
    this.data.files[relPath] = entry;
  }

  public remove(relPath: string): void {
    delete this.data.files[relPath];
  }

  public paths(): string[] {
    return Object.keys(this.data.files);
  }

  public async save(): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(
      this.filePath,
      JSON.stringify(this.data, null, 2),
      "utf8",
    );
  }
}
