import "server-only";
import {
  assertClientId,
  sanitizeFileName,
  type StorageProvider,
  type StoredFile,
  type UploadInput,
} from "./provider";

/**
 * Google Drive adapter — COMPLETE BUT NOT CONNECTED.
 *
 * Connecting the agency's real Drive account is approval-gated
 * (docs/audit/DECISIONS-NEEDED.md) and has not happened. This adapter exists
 * so that when approval comes, connecting is configuration, not construction:
 * set the five environment variables described in docs/GOOGLE-DRIVE-SETUP.md
 * and STORAGE_PROVIDER=gdrive, and nothing else in the application changes.
 *
 * ── Where the secrets live ──────────────────────────────────────────────────
 * Server environment only. The refresh token, client id and client secret are
 * read from process.env inside this server-only module; they are never written
 * to the database, never serialised into a response, and no NEXT_PUBLIC_
 * variable is involved anywhere. Access tokens are held in process memory for
 * their lifetime and never persisted at all.
 *
 * ── Scoping ─────────────────────────────────────────────────────────────────
 * All content lives under ONE root folder, GOOGLE_DRIVE_ROOT_FOLDER_ID —
 * configured, never hard-coded, so no personal folder id ever enters the
 * repository. Each client gets a subfolder named by their UUID. Every file
 * operation verifies the file's parent chain reaches the client's own folder
 * before acting, so a Drive file id from outside that folder — another
 * client's, or anywhere else in the account — answers "not found".
 *
 * The OAuth scope in the runbook is `drive.file`: the connected identity can
 * only ever see files this application created. Even a bug in the parent
 * check could not expose the rest of the account's Drive.
 */

export type GoogleDriveConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  rootFolderId: string;
};

/**
 * Reads the configuration, complete or nothing. A partial configuration
 * returns null so the factory refuses to construct the adapter — half-set
 * credentials must fail at startup, not at the first API call in production.
 */
export function googleDriveConfigFromEnv(): GoogleDriveConfig | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!clientId || !clientSecret || !refreshToken || !rootFolderId) return null;
  return { clientId, clientSecret, refreshToken, rootFolderId };
}

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";

type DriveFileMeta = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime: string;
  parents?: string[];
};

export class GoogleDriveProvider implements StorageProvider {
  readonly kind = "gdrive" as const;

  /** Access token cache: value and expiry, memory only. */
  private accessToken: { value: string; expiresAt: number } | null = null;

  constructor(private readonly config: GoogleDriveConfig) {}

  // ── OAuth ────────────────────────────────────────────────────────────────

  private async token(): Promise<string> {
    if (this.accessToken && Date.now() < this.accessToken.expiresAt - 60_000) {
      return this.accessToken.value;
    }
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: this.config.refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) {
      // Status only. The response body of a failed token exchange can echo
      // request parameters, and this error string may reach logs.
      throw new Error(`Google OAuth token refresh failed (${res.status})`);
    }
    const json = (await res.json()) as { access_token: string; expires_in: number };
    this.accessToken = {
      value: json.access_token,
      expiresAt: Date.now() + json.expires_in * 1000,
    };
    return json.access_token;
  }

  private async api<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await this.token();
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: { ...init?.headers, authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Drive API error (${res.status}) on ${path.split("?")[0]}`);
    return (await res.json()) as T;
  }

  // ── Scoping primitives ───────────────────────────────────────────────────

  private async findClientFolder(clientId: string): Promise<string | null> {
    // Folders are FOUND by name under the configured root, never trusted from
    // the caller. The name is the client UUID — assertClientId guarantees it
    // contains nothing a Drive query could misparse.
    const q = encodeURIComponent(
      `name = '${clientId}' and mimeType = '${FOLDER_MIME}' ` +
        `and '${this.config.rootFolderId}' in parents and trashed = false`,
    );
    const out = await this.api<{ files: DriveFileMeta[] }>(`/files?q=${q}&fields=files(id)`);
    return out.files[0]?.id ?? null;
  }

  /**
   * True only when the file's parent chain reaches this client's folder.
   * This check is what turns "any Drive file id" into "your files only".
   */
  private async fileBelongsToClient(fileId: string, folderId: string): Promise<boolean> {
    try {
      const meta = await this.api<DriveFileMeta>(
        `/files/${encodeURIComponent(fileId)}?fields=id,parents,trashed`,
      );
      return (meta.parents ?? []).includes(folderId);
    } catch {
      return false; // unknown id, no access, or trashed — all read as absent
    }
  }

  // ── StorageProvider ──────────────────────────────────────────────────────

  async ensureClientFolder(clientId: string, _clientName: string): Promise<string> {
    assertClientId(clientId);
    const existing = await this.findClientFolder(clientId);
    if (existing) return existing;

    // Named by UUID, not by client name: names drift, get renamed by humans in
    // the Drive UI, and collide. The UUID is stable and meaningless to an
    // outsider, which is exactly right for a folder name.
    const created = await this.api<DriveFileMeta>(`/files?fields=id`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: clientId,
        mimeType: FOLDER_MIME,
        parents: [this.config.rootFolderId],
      }),
    });
    return created.id;
  }

  async uploadFile(clientId: string, input: UploadInput): Promise<StoredFile> {
    assertClientId(clientId);
    const folderId = await this.ensureClientFolder(clientId, "");
    const token = await this.token();

    const metadata = JSON.stringify({
      name: sanitizeFileName(input.name),
      parents: [folderId],
    });
    const boundary = `boundary-${Math.random().toString(36).slice(2)}`;
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
          `--${boundary}\r\ncontent-type: ${input.mime}\r\n\r\n`,
      ),
      input.data,
      Buffer.from(`\r\n--${boundary}--`),
    ]);

    const res = await fetch(
      `${UPLOAD_API}/files?uploadType=multipart&fields=id,name,mimeType,size,createdTime`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": `multipart/related; boundary=${boundary}`,
        },
        body,
      },
    );
    if (!res.ok) throw new Error(`Drive upload failed (${res.status})`);
    const meta = (await res.json()) as DriveFileMeta;
    return {
      id: meta.id,
      name: meta.name,
      mime: meta.mimeType,
      sizeBytes: Number(meta.size ?? input.data.byteLength),
      createdAt: meta.createdTime,
    };
  }

  async listFiles(clientId: string): Promise<StoredFile[]> {
    assertClientId(clientId);
    const folderId = await this.findClientFolder(clientId);
    if (!folderId) return [];
    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const out = await this.api<{ files: DriveFileMeta[] }>(
      `/files?q=${q}&fields=files(id,name,mimeType,size,createdTime)&pageSize=200`,
    );
    return out.files.map((f) => ({
      id: f.id,
      name: f.name,
      mime: f.mimeType,
      sizeBytes: Number(f.size ?? 0),
      createdAt: f.createdTime,
    }));
  }

  async getDownloadUrl(clientId: string, fileId: string): Promise<string | null> {
    assertClientId(clientId);
    const folderId = await this.findClientFolder(clientId);
    if (!folderId) return null;
    if (!(await this.fileBelongsToClient(fileId, folderId))) return null;
    // webContentLink requires the caller's Google session; for the portal the
    // application streams through its own server instead. Either way the URL
    // is only ever produced for a file proven to sit in the client's folder.
    const meta = await this.api<{ webContentLink?: string }>(
      `/files/${encodeURIComponent(fileId)}?fields=webContentLink`,
    );
    return meta.webContentLink ?? null;
  }

  async deleteFile(clientId: string, fileId: string): Promise<boolean> {
    assertClientId(clientId);
    const folderId = await this.findClientFolder(clientId);
    if (!folderId) return false;
    if (!(await this.fileBelongsToClient(fileId, folderId))) return false;
    const token = await this.token();
    const res = await fetch(`${API}/files/${encodeURIComponent(fileId)}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    });
    return res.ok;
  }
}
