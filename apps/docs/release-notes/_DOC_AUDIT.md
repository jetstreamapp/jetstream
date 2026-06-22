# Doc staleness audit

Generated 2026-04-20 while backfilling release notes for v7.0.0 through v9.14.0. Each entry flags a feature that shipped in the noted release but may not be covered (or accurately covered) in the corresponding docs page. Filename is `_`-prefixed so Docusaurus ignores it.

**How to use this:** walk through each entry, open the suggested docs page, and either confirm the current doc is accurate or update it. Items are sorted by docs area so a docs writer can batch work.

---

## Query

- **v7.0.0 — Datatable keyboard navigation** (Tab across action/Id columns, Enter opens record popover, focus styles on keyboard-copy). Check [query-results.mdx](../docs/query/query-results.mdx) for a "Keyboard shortcuts" section; consider adding one if missing.
- **v7.3.2 — Bulk update results modal.** Verify `query-results.mdx` covers the full bulk-update-from-query flow (selecting records, running updates, viewing results).
- **v7.6.0 — Record modal at app level.** View/Edit/Clone record modal is now managed at the application level and emits recent-records updates. `query-results.mdx` may describe this only as a query-results feature.
- **v8.4.0 — Query area updates** (broad). Spot-check `query-results.mdx` against the release highlights.
- **v8.5.0 — Binary attachment downloads overhaul** (server streaming, Static Resource support, automatic field re-query). Check [download-attachments.mdx](../docs/query/download-attachments.mdx) screenshots and flow.
- **v8.9.0 — Edit/create/clone modal respects View All records.** Worth a paragraph in `query-results.mdx`.
- **v8.13.0 / v8.14.0 / v8.15.1 — Record lookup editor, polymorphic object selection, query-filter-value lookup.** Likely needs new sections in `query-results.mdx`.
- **v8.21.0 — Attachment download caps raised (500 MB to 1 GB; 2000/250 result caps).** Diff touched `download-attachments.mdx`; verify the documented numbers match the new caps.
- **v9.10.0 — Context menu on tables.** Copy-to-clipboard now works on duplicate records, data-load preview, load-failures modal, Automation Control editor, and Debug Log viewer. `query-results.mdx` should mention the right-click actions (the existing v9.10.0 post incorrectly scoped this to duplicates only).
- **v9.13.0 — Name columns render as links.** Only Name / relationship-Name columns got the new clickable behavior; Id columns already had it. Update `query-results.mdx` accordingly.

## Load

- **v7.2.0 — Copy load results to clipboard** (Excel/CSV/JSON from the results modal). No doc yet; consider adding to [load.mdx](../docs/load/load.mdx) or [update-records.mdx](../docs/load/update-records.mdx).
- **v7.6.0 — Google Sheet refresh.** Refresh works reliably after navigating forward/back. Note in `load.mdx`.
- **v7.6.2 — Binary attachment upload limits.** `load-attachments.mdx` was updated in the PR; verify wording covers "desktop/extension unlimited, web paid 1 GB."
- **v7.7.0 — Field mapping dropdown update** (badge removed). Screenshots in `update-records.mdx` may be stale.
- **v7.8.0 — Streaming multipart binary uploads, raised free-plan attachment limit.** `load-attachments.mdx` should reflect streaming behavior and current limits.
- **v8.2.0 — `rollbackOnError` default for production orgs.** Consider mentioning in [load-custom-metadata.mdx](../docs/load/load-custom-metadata.mdx).
- **v8.3.0 — Polymorphic related-object loading and retry UX.** Verify [load-with-related.mdx](../docs/load/load-with-related.mdx) covers on-demand metadata fetch and retry.
- **v8.15.1 — Hard delete in load records.** New option in `update-records.mdx`; confirm it is documented.
- **v8.17.0 — Large XLSX handling.** Large spreadsheets no longer error with "Invalid Array Length." Optional note in `load.mdx`.
- **v8.18.0 — Zip preview + missing-attachment error handling.** Extend `load-attachments.mdx`.
- **v8.21.0 — Data load batch limits (tiered).** Diff touched `load.mdx`; verify tiers are accurately reflected.
- **v8.23.0 — "Save anyway" / optional audit-field setting on record create.** No doc yet; consider extending [create-record-without-file.mdx](../docs/load/create-record-without-file.mdx).
- **v8.24.0 — Google folder memory.** `load.mdx` could mention Jetstream remembers the most recently used Drive folder.
- **v9.4.0 — Google Drive picker on desktop + extension.** `load.mdx` and/or export docs may still imply Drive is web-only.
- **v9.12.0 — Bulk API fatal-error handling.** Behavior change for how loads stop on unrecoverable errors. Update `load.mdx`.
- **v9.12.1 — Retry failed rows.** Prominent feature in the failures modal. Verify `update-records.mdx` / `load.mdx`.

## Deploy

- **v7.1.0 — "Toggle unchanged lines" in metadata-compare modal.** [deploy-metadata.mdx](../docs/deploy/deploy-metadata.mdx) likely doesn't describe this control.
- **v7.1.0 — Folder metadata types** (Document, Email, Report, Dashboard folders now selectable). Update `deploy-metadata.mdx` if it implies folders aren't supported.
- **v7.3.5 — Diff editor swap + collapse-unchanged-regions controls.** Verify `deploy-metadata.mdx`.
- **v7.6.0 — Add-to-Changeset deploy options, prod default rollback-on-failure.** Add to `deploy-metadata.mdx`.
- **v8.11.0 — `package.xml` comment support + production test-level validation.** Both warrant notes in `deploy-metadata.mdx`.
- **v8.24.0 — Custom metadata last-modified display + invalid-timestamp warning.** Consider in `deploy-metadata.mdx`.
- **v9.4.0 — SFDX change tracking for newly created fields.** Note in [deploy-fields.mdx](../docs/deploy/deploy-fields.mdx) that SFDX CLI will now pick up permission changes on new fields.
- **v9.5.0 — Formula evaluator engine swap to `sf-formula-parser`.** Spot-check [formula-evaluator.mdx](../docs/deploy/formula-evaluator.mdx) for any behavior differences to call out.
- **v9.10.0 — "Load Existing Fields" modal in Create Fields.** New feature; `deploy-fields.mdx` should describe it.
- **v9.10.0 — sObject export Description field.** The v9.10.0 prior-draft called this "object-level Description"; actually the **field-level** `Description` from `FieldDefinition`. Update [export-object-metadata.mdx](../docs/developer/export-object-metadata.mdx).

## Permissions

- **v7.9.0 — View All Fields object permission.** Add the `viewAllFields` column to [permissions.mdx](../docs/permissions/permissions.mdx).
- **v8.20.0 — Permission manager CSV fallback and error UX.** Update `permissions.mdx`.
- **v9.14.0 — `ProfileOrPermSetPopover` info popover.** The existing v9.14.0 draft mischaracterized this as a "quick-filter picker"; it's actually an **info/details popover** (per-row icon, searchable active-user list, Setup link). Update `permissions.mdx` to reflect the real behavior.

## Developer

- **v9.10.0 — sObject export Description field** (see Deploy section — same item, cross-listed).
- **v9.1.0 — Paste sanitization** across editors (invisible characters stripped). Worth a note in [anonymous-apex.mdx](../docs/developer/anonymous-apex.mdx) and any other editor pages.

## Team management

- **v8.0.0 — Team plan + team dashboard.** `team-management.mdx` was added; verify login-configuration coverage matches current UI.
- **v8.8.0 — "Jetstream Organization" rename to "Organization Group."** Scan `team-management/` for leftover "Jetstream Organization" terminology.
- **v8.8.0 — Org expiration 90-day workflow + notification emails.** No doc yet; consider adding.
- **v8.8.0 — Bulk org delete modal.** Screenshot refresh on org pages.
- **v8.9.0 — Team role restrictions** (billing-only users can't modify admins). Note in `team-management.mdx`.
- **v8.16.0 — Desktop team-dashboard link.** Note that desktop is supported on `team-management.mdx`.
- **v8.22.0 — Org-group auto-select on change.** Consider noting in `org-groups.mdx` or a getting-started section.
- **v9.0.0 — SSO (SAML / OIDC).** Docs exist under [team-management/sso/](../docs/team-management/sso/); confirm top-level overview links to SSO configuration.
- **v9.8.0 — IdP-initiated OIDC login.** SSO setup page should list redirect URIs for Okta, Entra, Google Workspace.

## Getting started / security

- **v7.3.0 — Desktop app Windows support.** Verify [desktop-app.mdx](../docs/getting-started/desktop-app.mdx) covers Windows install, auto-update, and Start Menu behavior.
- **v7.3.3 — Upcoming Salesforce Connected App changes banner.** Consider a dedicated section in [troubleshooting.mdx](../docs/getting-started/troubleshooting.mdx) keyed to the banner link.
- **v7.4.0 — Per-org encryption keys** (backend/security). Optional mention in `security.mdx`.
- **v7.7.0 — CSRF protection.** Transparent; an optional note in a security/FAQ page.
- **v7.10.0 — Outbound IP address ranges page.** New partial [_ip-address-ranges.mdx](../docs/getting-started/_ip-address-ranges.mdx); review for accuracy once ranges are finalized.
- **v8.6.0 — Cookie consent banner.** If analytics behavior is documented anywhere, update.
- **v8.7.0 — Connected app install doc links.** Verify install/sandbox docs cover the "sync permissions to sandbox" callout.
- **v8.9.0 — Auth hardening** (password history, account lockout, email-enumeration protection). `security.mdx` could mention.
- **v8.9.0 — In-app feedback widget placement.** Not in `feedback.mdx`; consider adding.
- **v8.21.0 — Movable / hide-able feedback widget.** Consider a section under a general UI or settings doc.
- **v8.25.0 — Quick record view in extension.** Verify [browser-extension.mdx](../docs/getting-started/browser-extension/browser-extension.mdx) covers the new in-tab quick-view action.
- **v9.0.0 — TOTP grace period.** Check `security.mdx`.
- **v9.3.0 — Terms of Service acceptance flow.** No doc page; consider one under account/auth.
- **v9.3.0 — Per-user desktop encryption.** Note on `desktop-app.mdx` for VDI/multi-user setups.
- **v9.4.0 — Feedback widget keyboard navigation** (Arrow keys, Home/End, Escape, Shift+F10). If an accessibility page exists, add.

## Miscellaneous

- **v9.9.0 — Deferred response middleware.** No more 524 errors on long requests. If any troubleshooting doc lists a 524 workaround, remove or update it.
- **v9.2.0 — Marketing landing page refresh** (not docs; no action).
- **v8.15.0 — User-configurable SOQL format options.** No existing doc covers this; consider a new settings section under `query/`.

---

## Notes

- This audit was compiled from the PR/diff research done while writing each release note. It is a starting point, not an exhaustive docs TODO. Some flagged items may already be covered (subagents flag when uncertain).
- Several release notes previously made inaccurate claims; the v9.10.0-v9.14.0 set was rewritten from scratch with verified facts. If you discover other release notes with similar issues, please correct them in place.
