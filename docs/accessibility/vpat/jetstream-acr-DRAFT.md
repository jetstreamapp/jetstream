# Jetstream Accessibility Conformance Report — DRAFT

Based on ITI **VPAT® Version 2.5 (WCAG edition)**. Rename to `jetstream-acr-<YYYY-MM>.md` when published.

**Name of Product/Version:** Jetstream web application (including the Jetstream desktop application) — version/date: _TBD at publication_

**Report Date:** _TBD_

**Product Description:** Jetstream is a Salesforce management platform for working with Salesforce data and metadata: querying and loading records, managing permissions and automation, deploying metadata, and developer tooling.

**Contact Information:** support@getjetstream.app

**Notes:** The desktop application is an Electron shell rendering the same web application and shares its conformance profile. The marketing/authentication site (getjetstream.app), documentation site (docs.getjetstream.app), and browser extension are separate surfaces; material differences are noted in remarks.

**Evaluation Methods Used:**

- Automated scanning with axe-core (version _TBD_) via Playwright across all application routes and key interactive states (evidence: CI `a11y-results` artifacts).
- Component-level axe-core assertions in unit tests.
- Manual keyboard-only testing of representative task flows.
- Manual screen reader testing with VoiceOver on macOS (Safari/Chrome).
- Zoom (200%), reflow (320px width), and text-spacing testing.

**Applicable standards:** WCAG 2.1 Level A and Level AA.

**Conformance level terms:** Supports / Partially Supports / Does Not Support / Not Applicable, per VPAT 2.5 definitions.

## Table 1: WCAG 2.1 Level A

| Criteria                                                   | Conformance Level | Remarks and Explanations                                                                                              |
| ---------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1.1.1 Non-text Content                                     | _TBD_             |                                                                                                                       |
| 1.2.1 Audio-only and Video-only (Prerecorded)              | Not Applicable    | The product contains no prerecorded audio-only or video-only content. _(confirm at publication)_                      |
| 1.2.2 Captions (Prerecorded)                               | Not Applicable    | The product contains no prerecorded synchronized media. _(confirm)_                                                   |
| 1.2.3 Audio Description or Media Alternative (Prerecorded) | Not Applicable    | See 1.2.2.                                                                                                            |
| 1.3.1 Info and Relationships                               | _TBD_             |                                                                                                                       |
| 1.3.2 Meaningful Sequence                                  | _TBD_             |                                                                                                                       |
| 1.3.3 Sensory Characteristics                              | _TBD_             |                                                                                                                       |
| 1.4.1 Use of Color                                         | _TBD_             |                                                                                                                       |
| 1.4.2 Audio Control                                        | Not Applicable    | The product does not auto-play audio. _(confirm)_                                                                     |
| 2.1.1 Keyboard                                             | _TBD_             | Known gaps under remediation: tab arrow-key navigation, time picker, drag-and-drop alternative (findings C2, C3, C8). |
| 2.1.2 No Keyboard Trap                                     | _TBD_             | Verify code editor escape affordance (finding C9).                                                                    |
| 2.1.4 Character Key Shortcuts                              | _TBD_             |                                                                                                                       |
| 2.2.1 Timing Adjustable                                    | _TBD_             | Session timeout behavior; toast auto-dismiss (finding C6).                                                            |
| 2.2.2 Pause, Stop, Hide                                    | _TBD_             |                                                                                                                       |
| 2.3.1 Three Flashes or Below Threshold                     | _TBD_             | No flashing content is used by design.                                                                                |
| 2.4.1 Bypass Blocks                                        | _TBD_             | Skip link planned (finding C4).                                                                                       |
| 2.4.2 Page Titled                                          | _TBD_             |                                                                                                                       |
| 2.4.3 Focus Order                                          | _TBD_             |                                                                                                                       |
| 2.4.4 Link Purpose (In Context)                            | _TBD_             |                                                                                                                       |
| 2.5.1 Pointer Gestures                                     | _TBD_             |                                                                                                                       |
| 2.5.2 Pointer Cancellation                                 | _TBD_             |                                                                                                                       |
| 2.5.3 Label in Name                                        | _TBD_             |                                                                                                                       |
| 2.5.4 Motion Actuation                                     | Not Applicable    | No motion-actuated functionality. _(confirm)_                                                                         |
| 3.1.1 Language of Page                                     | _TBD_             |                                                                                                                       |
| 3.2.1 On Focus                                             | _TBD_             |                                                                                                                       |
| 3.2.2 On Input                                             | _TBD_             |                                                                                                                       |
| 3.3.1 Error Identification                                 | _TBD_             | Form error association gaps (finding C5).                                                                             |
| 3.3.2 Labels or Instructions                               | _TBD_             |                                                                                                                       |
| 4.1.1 Parsing                                              | Supports          | Obsolete in WCAG 2.2; modern frameworks produce well-formed DOM.                                                      |
| 4.1.2 Name, Role, Value                                    | _TBD_             | Known gaps under remediation: combobox active descendant, time picker (findings C1, C3).                              |

## Table 2: WCAG 2.1 Level AA

| Criteria                                        | Conformance Level | Remarks and Explanations                                                                                          |
| ----------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1.2.4 Captions (Live)                           | Not Applicable    | No live synchronized media.                                                                                       |
| 1.2.5 Audio Description (Prerecorded)           | Not Applicable    | See 1.2.2.                                                                                                        |
| 1.3.4 Orientation                               | _TBD_             |                                                                                                                   |
| 1.3.5 Identify Input Purpose                    | _TBD_             | Autocomplete attributes on identity fields (lint: autocomplete-valid).                                            |
| 1.4.3 Contrast (Minimum)                        | _TBD_             | SLDS design tokens are broadly compliant; custom styles to verify.                                                |
| 1.4.4 Resize Text                               | _TBD_             |                                                                                                                   |
| 1.4.5 Images of Text                            | _TBD_             |                                                                                                                   |
| 1.4.10 Reflow                                   | _TBD_             | Data-dense screens (grids) rely on two-dimensional layout, which reflow exempts; verify remaining views at 320px. |
| 1.4.11 Non-text Contrast                        | _TBD_             |                                                                                                                   |
| 1.4.12 Text Spacing                             | _TBD_             |                                                                                                                   |
| 1.4.13 Content on Hover or Focus                | _TBD_             | Tooltips/popovers: dismissable, hoverable, persistent.                                                            |
| 2.4.5 Multiple Ways                             | _TBD_             | Navigation menu + home page cards.                                                                                |
| 2.4.6 Headings and Labels                       | _TBD_             |                                                                                                                   |
| 2.4.7 Focus Visible                             | _TBD_             |                                                                                                                   |
| 3.1.2 Language of Parts                         | _TBD_             |                                                                                                                   |
| 3.2.3 Consistent Navigation                     | _TBD_             |                                                                                                                   |
| 3.2.4 Consistent Identification                 | _TBD_             |                                                                                                                   |
| 3.3.3 Error Suggestion                          | _TBD_             |                                                                                                                   |
| 3.3.4 Error Prevention (Legal, Financial, Data) | _TBD_             | Destructive data-load operations have confirmation steps.                                                         |
| 4.1.3 Status Messages                           | _TBD_             | Live regions exist for grid status, jobs, and toasts; completeness under review (finding C6).                     |

---

_Every `TBD` must be resolved from the findings log and scan evidence before this report is published. Findings referenced as C# live in `../audit-2026/findings.md`._
