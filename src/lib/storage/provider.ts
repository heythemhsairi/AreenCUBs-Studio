import "server-only";

/**
 * The storage-provider boundary.
 *
 * Everything the application wants from an external file store goes through
 * this interface, and the interface is designed so the two rules that matter
 * cannot be broken by a caller:
 *
 * 1. **Every operation is scoped to a client.** There is no `listAll()`, no
 *    `getRootFolder()`, no method that takes a raw provider path. A caller
 *    holds a `clientId` and can express nothing outside that client's folder,
 *    so "a client browses the agency root" is not a bug to prevent — it is a
 *    sentence this API cannot say.
 *
 * 2. **Nothing provider-specific leaks upward.** Callers see opaque file ids
 *    and short-lived URLs. Folder ids, OAuth tokens and API shapes stay inside
 *    the adapter, which is the only file that changes when the provider does.
 *
 * The concrete provider is chosen by `getStorageProvider()` from the
 * STORAGE_PROVIDER environment variable. The default is the local mock;
 * selecting Google Drive requires complete server-side configuration AND the
 * separate approval recorded in docs/audit/DECISIONS-NEEDED.md — connecting
 * the real account is approval-gated and has not happened.
 */

export type StoredFile = {
  /** Opaque provider id. Never a path; never parseable by callers. */
  id: string;
  name: string;
  mime: string;
  sizeBytes: number;
  createdAt: string;
};

export type UploadInput = {
  name: string;
  mime: string;
  data: Buffer;
};

export interface StorageProvider {
  /** Human-readable name, for diagnostics and the settings screen. */
  readonly kind: "mock" | "gdrive";

  /**
   * Ensures the client's dedicated folder exists and returns its opaque id.
   * Idempotent: calling it twice returns the same folder.
   */
  ensureClientFolder(clientId: string, clientName: string): Promise<string>;

  /** Uploads into the client's folder. The caller cannot choose a path. */
  uploadFile(clientId: string, input: UploadInput): Promise<StoredFile>;

  /** Lists the client's folder and nothing else. */
  listFiles(clientId: string): Promise<StoredFile[]>;

  /**
   * A short-lived URL for one file in the client's folder. Returns null when
   * the file does not exist THERE — a file id from another client's folder is
   * "not found", never "forbidden", so ids cannot be probed across clients.
   */
  getDownloadUrl(clientId: string, fileId: string): Promise<string | null>;

  /** Deletes one file from the client's folder. False when absent there. */
  deleteFile(clientId: string, fileId: string): Promise<boolean>;
}

/** UUID shape — the only client identifier the providers accept. */
const CLIENT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Guard shared by every provider. A client id that is not a UUID is refused
 * outright rather than sanitised: the id names a folder in an external system,
 * and "fix it up" is how a crafted value like `../root` becomes a traversal.
 */
export function assertClientId(clientId: string): void {
  if (!CLIENT_ID_RE.test(clientId)) {
    throw new Error("Invalid client id for storage scoping");
  }
}

/**
 * File names are display data, not paths. Only the last path segment is kept,
 * and control or provider-reserved characters are dropped, so neither a
 * traversal like `../../etc/passwd` nor a NUL byte survives into a provider
 * call. Filtered by char code rather than a regex character class: this exact
 * function has now twice been corrupted in transit by escape-sequence
 * mangling, and code points cannot be.
 */
const RESERVED_NAME_CHARS = new Set(Array.from('<>:"|?*'));
const BACKSLASH = String.fromCharCode(92);

export function sanitizeFileName(name: string): string {
  const cut = Math.max(name.lastIndexOf("/"), name.lastIndexOf(BACKSLASH));
  const base = cut >= 0 ? name.slice(cut + 1) : name;
  const cleaned = Array.from(base)
    .filter((ch) => ch.charCodeAt(0) >= 32 && !RESERVED_NAME_CHARS.has(ch))
    .join("")
    .trim();
  return cleaned.length > 0 ? cleaned.slice(0, 180) : "sans-nom";
}

import { MockStorageProvider } from "./mock-provider";
import { GoogleDriveProvider, googleDriveConfigFromEnv } from "./gdrive-provider";

let cached: StorageProvider | null = null;

/**
 * Resolves the configured provider.
 *
 * Fails closed in both directions: an unknown STORAGE_PROVIDER value is an
 * error rather than a silent fallback, and `gdrive` with incomplete
 * configuration refuses to construct rather than limping into half-configured
 * API calls. The mock needs no configuration and is the default, so every
 * environment works out of the box without a single external credential.
 */
export function getStorageProvider(): StorageProvider {
  if (cached) return cached;

  const kind = process.env.STORAGE_PROVIDER ?? "mock";
  switch (kind) {
    case "mock":
      cached = new MockStorageProvider();
      return cached;
    case "gdrive": {
      const config = googleDriveConfigFromEnv();
      if (!config) {
        throw new Error(
          "STORAGE_PROVIDER=gdrive but the Google Drive configuration is incomplete. " +
            "See docs/GOOGLE-DRIVE-SETUP.md — connecting the real account is approval-gated.",
        );
      }
      cached = new GoogleDriveProvider(config);
      return cached;
    }
    default:
      throw new Error(`Unknown STORAGE_PROVIDER: ${kind}`);
  }
}

/** Test hook: clears the memoised provider so env changes take effect. */
export function resetStorageProviderForTests(): void {
  cached = null;
}
