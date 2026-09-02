# Manual Accessibility Audit — Checklist & How-To

Automated axe scans only cover roughly a third of WCAG. This checklist covers the rest: three
passes (keyboard, screen reader, visual) over ~10 representative flows. Budget **half a day** total.
No prior screen-reader experience is assumed.

Record every problem you find in the **Manual audit findings** table in `findings.md` (same folder):
what happened, which flow, severity (P1 = you couldn't complete the task / P2 = degraded but
workable / P3 = polish). The table has four columns (`#`, Finding, WCAG, Status) — severity, flow and
file go in the Finding cell. When in doubt, write it down — triage later.

---

## One-time setup (10 minutes)

1. **Make Tab reach everything (macOS skips buttons by default):**
   - System Settings → Keyboard → turn ON **Keyboard navigation**.
   - If testing in Safari: Safari → Settings → Advanced → check **"Press Tab to highlight each item on a webpage"**. (Chrome doesn't need this.)
2. **VoiceOver basics** (the built-in macOS screen reader):
   - Toggle on/off: **Cmd + F5** (or triple-press Touch ID button).
   - The "VO keys" are **Control + Option** held together. Everything below writes them as `VO`.
   - Move to next/previous item: `VO + →` / `VO + ←`
   - Click the current item: `VO + Space`
   - Open the **Rotor** (a menu of all headings/links/form controls on the page): `VO + U`, then ←/→ to switch lists, ↑/↓ to browse, Enter to jump.
   - Stop VoiceOver talking for a moment: **Control**.
   - First time: run the built-in tutorial once (VoiceOver announces it when first enabled) — 5 minutes, worth it.
3. **Reduced motion:** System Settings → Accessibility → Display → note where **Reduce motion** is (you'll toggle it once during the visual pass).
4. **Start the app** (`pnpm start:e2e` serves the built app at `localhost:3333`) and log in before starting a pass.

---

## Pass 1 — Keyboard only (~90 min)

Unplug the mouse mentally: complete each flow in the table below using **only** Tab / Shift+Tab,
Enter, Space, Arrow keys, and Esc. For every flow ask these five questions:

| #   | Check                                                               | Fails when…                                                                                                                                                                                          | WCAG         |
| --- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| K1  | Can I reach every control?                                          | A button/menu/row only works with a mouse                                                                                                                                                            | 2.1.1        |
| K2  | Can I always see where I am?                                        | Focus outline disappears, or you lose your place after a dialog closes                                                                                                                               | 2.4.7, 2.4.3 |
| K3  | Can I always get out?                                               | Focus gets stuck in a widget/editor and Tab won't leave (Monaco editors: **Ctrl+M** / **Ctrl+Shift+M** on Mac toggles Tab trapping — after toggling, Tab must leave the editor; C9 regression check) | 2.1.2        |
| K4  | Does Esc close overlays, and does focus return to what opened them? | Modal/popover closes but focus is lost at the top of the page                                                                                                                                        | 2.4.3        |
| K5  | Does focus move in a sensible order?                                | Tab jumps around visually at random                                                                                                                                                                  | 2.4.3        |

Regression checks to hit deliberately (all fixed on the 2026 branch — confirm they stay fixed):
**tabs** (Arrow/Home/End switch them — C2), **time picker** (type-to-filter combobox — C3), **query
filter drag-and-drop** (dnd-kit keyboard reorder: Space picks up, arrows move, Space drops — C8),
**comboboxes** (arrow keys announce options, Enter selects, Esc closes only the menu — C1, M47),
**data grid** (arrow keys between cells, Enter to edit, one Esc cancels — M21, R4).

## Pass 2 — VoiceOver (~90 min)

Same flows, VoiceOver on, ideally in Safari (best VoiceOver support) with a Chrome spot-check.
Navigate mostly with Tab (forms/controls) and `VO + →` (reading through). For every flow:

| #   | Check                                                                                                                                        | Fails when…                                                                                    | WCAG         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------ |
| S1  | Does every control announce a sensible **name and role**? ("Query Records, link", "Salesforce objects, list box")                            | You hear "button" with no name, or a wrong/duplicate name                                      | 4.1.2        |
| S2  | In comboboxes/lists, is the **highlighted option announced** as you arrow through?                                                           | You arrow down and hear nothing (C1/M12 regression — the highlighted option must be announced) | 4.1.2        |
| S3  | Are **async results announced**? Run a query, start a load, save a record — do you hear the toast / "N records" status without moving focus? | Silence after an action completes                                                              | 4.1.3        |
| S4  | Do **form errors** get announced when you submit something invalid?                                                                          | Error appears visually, VoiceOver says nothing                                                 | 3.3.1        |
| S5  | Open the Rotor (`VO + U`) → Headings on 3–4 pages: do headings exist and outline the page sensibly?                                          | One giant unlabeled wall, or heading levels that skip around meaninglessly                     | 1.3.1, 2.4.6 |
| S6  | Are decorative icons silent, and meaningful images described?                                                                                | VoiceOver reads filenames or long gibberish                                                    | 1.1.1        |

## Pass 3 — Visual (~45 min)

1. **Zoom 200%** (`Cmd +` five times, or browser zoom to 200%): on each main screen — is all text readable, nothing clipped/overlapping, nothing unusable? (1.4.4)
2. **Reflow at 320px**: open DevTools responsive mode (Cmd+Opt+I → device toolbar), set width to **320**. Pages must not require horizontal scrolling of the page body. Data grids/two-dimensional tables ARE exempt — note them, don't fail them. (1.4.10)
3. **Text spacing**: install the bookmarklet from https://dylanb.github.io/bookmarklets.html ("text spacing"), click it on 3–4 dense pages. Content must not get cut off or overlap. (1.4.12)
4. **Hover/focus content** (1.4.13): for tooltips and popovers — can you move the pointer ONTO the tooltip without it vanishing? Does Esc dismiss it?
5. **Reduce motion**: toggle it on, reload — do large animations/spinners calm down or at least not break anything? (2.3.3 is AAA, so this is informational — note anything that flashes.)
6. **Color-only meaning** (1.4.1): find 2–3 places status is shown (load results success/failure, deploy status) — is there an icon/text besides just red/green?

---

## The flows

Work through these in order; the first four cover the most ground. Check off per pass.

| Flow                | What to do                                                                                                           | Kbd | VO  | Vis |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- | --- | --- | --- |
| Login               | Log out, log back in — including a wrong password to see the error handling (S4)                                     | ☐   | ☐   | ☐   |
| Query builder       | Pick org → pick Account → select 5 fields (checkboxes) → add a filter → run query                                    | ☐   | ☐   | ☐   |
| Query results grid  | Arrow around cells, sort a column, edit a cell, open row actions, copy                                               | ☐   | ☐   | ☐   |
| Load records        | Full wizard: pick object → upload a small CSV → map fields → run → read results                                      | ☐   | ☐   | ☐   |
| Modals & popovers   | Org details popover, a confirmation modal, help popover — open/close each (K3/K4)                                    | ☐   | ☐   | ☐   |
| Automation control  | Toggle something on/off, switch tabs with the arrow keys (C2 regression)                                             | ☐   | ☐   | ☐   |
| Permissions manager | Select profiles + objects, edit a permission in the grid                                                             | ☐   | ☐   | ☐   |
| Deploy metadata     | Select metadata, walk to the review step (don't deploy), use the date/time filters by keyboard (C3, M42 regressions) | ☐   | ☐   | ☐   |
| Anonymous Apex      | Type in the Monaco editor, toggle Tab trapping (Ctrl+M / Ctrl+Shift+M) and Tab out, run (C9 regression, K3, S3)      | ☐   | ☐   | ☐   |
| Profile & settings  | Change a setting, check the SOQL format inputs announce their labels                                                 | ☐   | ☐   | ☐   |

Landing/auth pages (signup, password reset) and docs get a lighter version: one keyboard tab-through
and one VoiceOver read-through each.

---

## Recording results

Add rows to **Manual audit findings** in `findings.md`:

```
| M61 | Arrowing through the org combobox announces nothing (S2, P1, `Combobox.tsx`) | 4.1.2 | open |
```

Two extra rules:

- **Regressions**: if a check fails on something an existing row already covers (C1–C10, M1–M60,
  R1–R21), reopen that row — set its status to `regressed (date)` — rather than adding a new one.
- **Passes matter too.** For each flow, record the pass in the evidence table below — the VPAT needs
  positive evidence for the "Supports" rows, not just a list of bugs.

When you're done, the results map straight onto the VPAT's remaining TBD rows
(`../vpat/jetstream-acr-DRAFT.md`) — hand the findings file over and the report can be finalized.

---

## Pass evidence — 2026 audit

Keyboard and VoiceOver passes completed 2026-08-28 → 2026-08-31 (first pass 08-28 → 31 over the ten
flows, second sweep 08-30 → 31 over every remaining page); the visual pass (200% zoom, 320px reflow,
contrast) is recorded in M22, M28 and M40 of `findings.md`. Everything found is logged and fixed there;
the rows cited are the evidence trail for the VPAT "Supports" rows.

| Flow                | Kbd                  | VO                   | Vis                              | Evidence (`findings.md`)                           |
| ------------------- | -------------------- | -------------------- | -------------------------------- | -------------------------------------------------- |
| Login               | pass 2026-08-28 → 31 | pass 2026-08-28 → 31 | pass 2026-08-31 (L2)             | L1, L2; `url-localhost-3333-auth_login` scan clean |
| Query builder       | pass 2026-08-28 → 31 | pass 2026-08-28 → 31 | pass 2026-08-31 (M22)            | M3–M13, M33, M57, R16                              |
| Query results grid  | pass 2026-08-28 → 31 | pass 2026-08-28 → 31 | pass 2026-08-31 (M22)            | M21, M25, M41, M58, M60, R15                       |
| Load records        | pass 2026-08-28 → 31 | pass 2026-08-28 → 31 | pass 2026-08-31 (M22)            | M17, M26, M31, M34, M35                            |
| Modals & popovers   | pass 2026-08-28 → 31 | pass 2026-08-28 → 31 | pass 2026-08-31 (M28)            | M18, M27, M28, M29, M47, M48, R13                  |
| Automation control  | pass 2026-08-30 → 31 | pass 2026-08-30 → 31 | pass 2026-08-31 (#2029 deferred) | C2, M43                                            |
| Permissions manager | pass 2026-08-30 → 31 | pass 2026-08-30 → 31 | pass 2026-08-31                  | M44, M45; X4 remains open                          |
| Deploy metadata     | pass 2026-08-30 → 31 | pass 2026-08-30 → 31 | pass 2026-08-31                  | M42, M49                                           |
| Anonymous Apex      | pass 2026-08-30 → 31 | pass 2026-08-30 → 31 | pass 2026-08-31                  | C9, M52, M53, M56                                  |
| Profile & settings  | pass 2026-08-30 → 31 | pass 2026-08-30 → 31 | pass 2026-08-31 (M40)            | M15, M30, M40, M56, X5, R6                         |
| Landing/auth & docs | pass 2026-08-28 → 31 | pass 2026-08-28 → 31 | pass 2026-08-31 (L2)             | L1–L3; 226-page URL scan                           |
