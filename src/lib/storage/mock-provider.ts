import "server-only";
import { randomUUID } from "node:crypto";
import {
  assertClientId,
  sanitizeFileName,
  type StorageProvider,
  type StoredFile,
  type UploadInput,
} from "./provider";

/**
 * The local storage provider: a faithful, in-memory stand-in for Drive.
 *
 * Faithful matters more than fancy here. It enforces the same contract the
 * real adapter must — per-client scoping, opaque ids, "not found" for another
 * client's file id — so code written against the mock does not acquire habits
 * the real provider would punish, and the scoping tests exercise real logic
 * rather than a stub that cannot fail.
 *
 * In-memory is a deliberate limit, not an oversight: this provider exists for
 * development and tests, both of which want a blank slate per process. Nothing
 * in the application treats external storage as the system of record.
 */

type MockFile = StoredFile & { data: Buffer };

export class MockStorageProvider implements StorageProvider {
  readonly kind = "mock" as const;

  /** clientId → folder id. */
  private folders = new Map<string, string>();
  /** clientId → its files. Files live under a client, never globally. */
  private files = new Map<string, Map<string, MockFile>>();

  async ensureClientFolder(clientId: string, _clientName: string): Promise<string> {
    assertClientId(clientId);
    let folder = this.folders.get(clientId);
    if (!folder) {
      folder = `mock-folder-${randomUUID()}`;
      this.folders.set(clientId, folder);
      this.files.set(clientId, new Map());
    }
    return folder;
  }

  async uploadFile(clientId: string, input: UploadInput): Promise<StoredFile> {
    assertClientId(clientId);
    await this.ensureClientFolder(clientId, "");
    const file: MockFile = {
      id: `mock-file-${randomUUID()}`,
      name: sanitizeFileName(input.name),
      mime: input.mime,
      sizeBytes: input.data.byteLength,
      createdAt: new Date().toISOString(),
      data: input.data,
    };
    this.files.get(clientId)!.set(file.id, file);
    const { data: _omit, ...visible } = file;
    return visible;
  }

  async listFiles(clientId: string): Promise<StoredFile[]> {
    assertClientId(clientId);
    const bucket = this.files.get(clientId);
    if (!bucket) return [];
    return Array.from(bucket.values()).map(({ data: _omit, ...visible }) => visible);
  }

  async getDownloadUrl(clientId: string, fileId: string): Promise<string | null> {
    assertClientId(clientId);
    // The lookup goes THROUGH the client's own bucket. A file id belonging to
    // another client simply is not in this map, so the answer is null — the
    // same null a nonexistent id gets, exactly as the interface requires.
    const file = this.files.get(clientId)?.get(fileId);
    if (!file) return null;
    return `mock://download/${clientId}/${fileId}?expires=300`;
  }

  async deleteFile(clientId: string, fileId: string): Promise<boolean> {
    assertClientId(clientId);
    return this.files.get(clientId)?.delete(fileId) ?? false;
  }
}
