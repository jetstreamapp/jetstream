# Jetstream — Data Flow & Authentication Diagrams

Maintained architecture diagrams describing how information flows across Jetstream's
systems and networks, and how Salesforce data and personal data (PII) are handled on
each product surface.

- **Audience:** SOC 2 auditors (control A1 — maintained data flow diagrams / process
  flowcharts of internal & external information sources and flows), customers (PII and
  data-residency questions), and internal engineering/security reference.
- **Accurate as of:** 2026-07-19, verified against the source code (see "Source of truth").
- **Formats:** each diagram is provided as a PNG (with the editable draw.io diagram
  embedded), a `.drawio` source, and — where authored in Mermaid — a `.mmd` source.
  `jetstream-data-flow-diagrams.pdf` contains all 11 diagrams as one file.

## The four product surfaces

| Surface           | What it is                                                                       |
| ----------------- | -------------------------------------------------------------------------------- |
| Web App           | React SPA at getjetstream.app; the Jetstream server proxies Salesforce API calls |
| Browser Extension | Chrome/Firefox extension that runs on a Salesforce tab                           |
| Desktop App       | Electron app that stores orgs locally, encrypted                                 |
| Managed Package   | Jetstream embedded inside Salesforce as a Canvas app                             |

## Headline compliance narrative

**On 3 of the 4 surfaces (Extension, Desktop, Managed Package), Salesforce record data
never traverses Jetstream servers** — the client talks to Salesforce directly. Only the
**Web App** proxies Salesforce data, and even then records pass through server memory only
and are never persisted; the Salesforce OAuth tokens it stores are encrypted at rest with a
per-user key. Jetstream never stores payment card data (delegated to Stripe). The entire
production database is encrypted at rest; on top of that, sensitive fields (Salesforce tokens,
MFA/SSO secrets) receive an additional layer of application-level encryption and passwords are
one-way hashed.

## Diagram index

### Overviews (best for customers & as auditor orientation)

| #   | File                         | Shows                                                                                                                                                                                                                                                             |
| --- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 00  | `00-system-context`          | All systems, trust boundaries, and which links carry Salesforce data through Jetstream vs. direct to Salesforce                                                                                                                                                   |
| 01  | `01-data-residency`          | Comparison matrix: does Salesforce data pass through Jetstream? where do credentials live? how are they protected? (per surface)                                                                                                                                  |
| 02  | `02-pii-data-classification` | Every category of personal data Jetstream stores, where, and its protection. All data is encrypted at rest at the database layer; the diagram shows the additional application-level protection (field-level encryption / one-way hash / delegation) per category |

### Authentication flows

| #   | File                    | Shows                                                                                             |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------- |
| 10  | `10-auth-web-app`       | User login: email+password and social OAuth/OIDC, 2FA (TOTP/email), session creation              |
| 11  | `11-auth-desktop`       | Browser-based login → JWT via deep link → delivery of the user-derived encryption key             |
| 12  | `12-auth-web-extension` | Jetstream-account login on the web, token bridged into the extension, entitlement re-verification |
| 13  | `13-auth-canvas`        | Salesforce-issued signed request, HMAC verification, org entitlement check                        |

### Salesforce data flows

| #   | File                      | Shows                                                                                                            |
| --- | ------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 20  | `20-sfdata-web-app`       | Connect org (OAuth) + encrypt tokens at rest; run query = decrypt → server calls Salesforce → results to browser |
| 21  | `21-sfdata-web-extension` | Uses the live Salesforce session cookie; browser calls Salesforce directly — no data through Jetstream           |
| 22  | `22-sfdata-desktop`       | Locally-stored encrypted orgs; main process calls Salesforce directly — no data through Jetstream                |
| 23  | `23-sfdata-canvas`        | Canvas SDK proxies calls browser → parent Salesforce window → Salesforce — no data through Jetstream             |

## Audience guidance

- **Customers:** diagrams 00, 01, 02 answer most questions directly. Diagrams 20–23 show
  where Salesforce data goes per surface. (Simplified, jargon-free variants of the flow
  diagrams can be produced on request.)
- **SOC 2 auditors (A1):** the full set. 00/01 narrate systems & network flows; 10–13 and
  20–23 are the detailed process flows including security controls (encryption algorithms,
  key management, signature verification, SSRF pinning).
- **Internal:** the flow diagrams reference the concrete endpoints, env-var-held secrets,
  and libraries so they double as an engineering reference.

## Source of truth (key code the diagrams reflect)

- Auth: `libs/auth/server/**`, `apps/api/src/app/controllers/auth.controller.ts`
- User/PII schema: `prisma/schema.prisma`
- Web-app SF token encryption: `apps/api/src/app/services/salesforce-org-encryption.service.ts`
  (per-user PBKDF2 + AES-256-GCM); connection factory `apps/api/src/app/routes/route.middleware.ts`
- Shared Salesforce client: `libs/salesforce-api/**` (`callout-adapter.ts`)
- Extension: `apps/jetstream-web-extension/**`
- Desktop: `apps/jetstream-desktop/**` (local storage `persistence.service.ts`); the desktop
  encryption key is derived server-side in `apps/api/src/app/controllers/desktop-app.controller.ts`
- Canvas: `apps/jetstream-canvas/**`, `apps/api/src/app/controllers/canvas.controller.ts`,
  `apps/api/src/app/utils/canvas.utils.ts`

## Editing / regenerating

Edit the **sources of truth**: the `.mmd` for Mermaid-authored diagrams, or the
`.drawio` directly for the hand-authored ones (01 and 02). You can also open any
`.png` or `.drawio` in [draw.io](https://draw.io) to edit (the PNGs embed the
diagram). The `.drawio.png` files and `jetstream-data-flow-diagrams.pdf` are
**generated artifacts** — don't hand-edit them; regenerate with `regenerate.sh`.

`./regenerate.sh` requires draw.io Desktop (provides the CLI), `pdfunite` (from
poppler: `brew install poppler`), and `perl` (for small in-place `.drawio`
post-processing; preinstalled on macOS and most Linux):

- `./regenerate.sh` — full rebuild: every `.mmd` → `.drawio`, all PNGs, then the combined PDF
- `./regenerate.sh <base>` — one diagram (e.g. `11-auth-desktop`): its `.drawio` (when it has a `.mmd`) + PNG
- `./regenerate.sh --pdf` — only the combined PDF, from the existing `.drawio` files

Caveats (also documented in the script):

- Diagram 00 is Mermaid-authored, but its `.drawio` was hand-edited to move the
  legend below the diagram (arrows were overlapping it). `regenerate.sh`
  intentionally **skips** 00's `.mmd` → `.drawio` conversion so that edit is
  preserved. If you re-convert it, re-apply the legend move (set the `Legend:`
  cell's `<mxGeometry>` to `x="560" y="635"`).
- Diagrams 01 and 02 have no `.mmd` — edit the `.drawio` directly.
- draw.io's Mermaid engine treats `__` in note text as Markdown **bold** and drops
  the underscores, so `jetstream__UserPreferences__c` (diagram 23) would come through
  as `jetstreamUserPreferencesc`. `regenerate.sh` restores it after conversion (see
  `apply_mermaid_fixups`); add a case there if you introduce other `__` identifiers.
