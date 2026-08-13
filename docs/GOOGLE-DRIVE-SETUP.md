# Google Drive — setup and permission runbook

**Status: NOT CONNECTED.** Connecting the agency's real Google account is
approval-gated (`docs/audit/DECISIONS-NEEDED.md`) and must be a separate,
deliberate decision by the owner. Everything below is preparation: when that
approval is given, connecting is configuration, not code.

The application ships with `STORAGE_PROVIDER=mock` (the default, no
configuration needed). Nothing anywhere depends on Drive being connected.

---

## 1. What the integration is, in one paragraph

All application-managed files live under **one root folder** in the agency's
Drive. Each client organisation gets **one subfolder, named by their internal
UUID** — stable, collision-free, and meaningless to an outsider. The
application only ever operates inside those subfolders through the
`StorageProvider` interface (`src/lib/storage/provider.ts`), which has no
method that could list or touch anything else: a client browsing the agency
root is not a prevented bug, it is a sentence the API cannot express.

## 2. Google Cloud setup (owner, ~20 minutes)

1. Create a Google Cloud project (any name; `areencubs-studio` suggested).
2. **APIs & Services → Library** → enable **Google Drive API**.
3. **OAuth consent screen**: internal use; add the agency Google account.
4. **Credentials → Create credentials → OAuth client ID**, type *Web
   application*. Note the **client id** and **client secret**.
5. Obtain a **refresh token** for the agency account using the OAuth playground
   or a one-time local script, requesting **exactly one scope**:

   ```
   https://www.googleapis.com/auth/drive.file
   ```

   `drive.file` is the entire security story in one line: the token can only
   see files **this application created**. Not the account's documents, not
   shared drives, nothing pre-existing. Even a bug in the application's own
   scoping checks cannot reach the rest of the Drive.

6. In Drive, create the root folder (suggested name: `AreenCUBs Studio —
   Clients`). Copy its folder id from the URL.

## 3. Server configuration

Five variables, **server environment only** — never in code, never in the
repository, never in any `NEXT_PUBLIC_*` variable, never pasted into a chat or
a ticket:

```
STORAGE_PROVIDER=gdrive
GOOGLE_OAUTH_CLIENT_ID=…
GOOGLE_OAUTH_CLIENT_SECRET=…
GOOGLE_OAUTH_REFRESH_TOKEN=…
GOOGLE_DRIVE_ROOT_FOLDER_ID=…
```

The root folder id is configuration for the same reason the tokens are: no
personal folder id may ever be hard-coded into the repository.

Token handling, as implemented in `src/lib/storage/gdrive-provider.ts`:

- The refresh token is read inside a `server-only` module and is never written
  to the database, serialised into a response, or logged.
- Short-lived access tokens live in process memory for their ~1-hour lifetime
  and are never persisted anywhere.
- Failed token exchanges are reported by **status code only**; the response
  body of a failed OAuth call can echo request parameters and never reaches a
  log.

If tokens ever need to move from environment variables into the database
(multi-tenant, several Drive accounts), they must be encrypted with a key held
outside the database — that design is deliberately not built until it is
needed.

## 4. The adapter's own guarantees

Independent of Google's scope enforcement:

- Client ids must be UUIDs (`assertClientId`) — a crafted id like `../root` is
  refused before any API call.
- Every file operation first verifies the file's **parent chain reaches the
  client's own folder**. A Drive file id from anywhere else answers **"not
  found"** — the same answer a nonexistent id gets, so ids cannot be probed
  across clients.
- File names are sanitised to their last path segment with control and
  reserved characters removed.

The local mock (`mock-provider.ts`) enforces this same contract and is what
the test suite runs against: `src/lib/storage/provider.test.ts` is the
executable form of the rules above.

## 5. Verification after connecting (when approved)

1. `STORAGE_PROVIDER=gdrive` in a **staging** environment first.
2. Create a fabricated client; call `ensureClientFolder`; confirm a UUID-named
   subfolder appears under the root and nowhere else.
3. Upload a test file through the application; confirm it lands inside that
   subfolder.
4. From a second fabricated client, attempt `getDownloadUrl` with the first
   client's file id; confirm the answer is null.
5. Check the Drive account's **Security → Third-party access** page: the app
   must show the `drive.file` scope only.
6. Only then consider production, with its own credentials.

## 6. Revocation

One place: the agency Google account → Security → Third-party access → remove
the app. Every refresh token dies with it. Then unset the five variables;
the application falls back to refusing `gdrive` at startup (it never silently
degrades to the mock in an environment that asked for Drive).
