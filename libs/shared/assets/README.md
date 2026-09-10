# shared-assets

Single source of truth for Jetstream's static images: logos and icons in every variation, favicons, marketing
screenshots, email icons, third-party marks and the Salesforce custom-object tab icons. Nothing image-like should be
committed anywhere else except screenshots that sit next to the docs page that embeds them and feature-specific
illustrations that only one lib uses.

## Layout

| Path                                   | Contents                                                                                                  |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `public/images/*`                      | Jetstream logos, icons and favicons (flat, names are part of public URLs and must stay stable), `manifest.json`, `browserconfig.xml` |
| `public/images/app/`                   | Illustrations rendered inside the app                                                                     |
| `public/images/desktop/`               | electron-builder icon sources (`icon.icns`, `icon.ico`, `icon.png` = 1024px, sized PNG set)               |
| `public/images/email/`                 | Icons used by email templates                                                                             |
| `public/images/sfdc-object-icons/`     | The 32px tab icons Salesforce offers for custom objects (`src/sfdc-object-icons.ts` maps them)            |
| `public/images/third-party/`           | Google, Salesforce, GitHub, Discord marks and the A-LIGN SOC 2 badges                                     |
| `public/images/website/`               | Landing page screenshots and the Open Graph image                                                         |

Logo naming: `jetstream-logo*` is the wordmark, `jetstream-icon*` the mark. Suffixes: `-inverse` (for dark backgrounds),
`-bare` (no rounded background), `-white-bg`, `-sfdc-blue`, `-pro`, `-v1`, and pixel sizes. `jetstream-icon-inverse.svg` is
the historical file served at that URL; `jetstream-icon-inverse-white.svg` is the true white-on-transparent mark and
`jetstream-icon-bare-dark.svg` the darker bare variant the landing page uses.

## How each app gets the files

Everything under `public/` is copied verbatim into the API's `assets/` output, so every file is reachable at
`/assets/images/<path>` on the server (`https://getjetstream.app/assets/images/<path>` in production). That is the URL
to use on external pages, in IdP configuration, and anywhere a bundler is not involved.

| Consumer                  | Mechanism                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------ |
| API, landing site, emails | `apps/api/project.json` copies `public/` to `assets/`; the API serves it with a 1 day cache lifetime    |
| Web app                   | `import { ... } from '@jetstream/shared/assets'` (Vite bundles the file); its favicons come from the API |
| Desktop client            | Imports as above; its favicon is the copy the desktop project places in `assets/images`, served by the `app://` protocol handler |
| Browser extension         | Imports as above, plus `sharedAssetsPlugin` in `vite.config.mts` copies the manifest icons into the bundle |
| Desktop (Electron main)   | `apps/jetstream-desktop/project.json` copies `desktop/` to `assets/icons` for electron-builder, and `favicon.ico` to `assets/images` for the client |
| Docs                      | `staticDirectories` in `docusaurus.config.ts` exposes `public/` so files resolve at `/images/<path>`    |
| Server code               | Build URLs with `ENV.JETSTREAM_SERVER_URL` + `/assets/images/<path>` (see `libs/auth/server/src/lib/auth.service.ts`) |
| Emails                    | `getEmailImageUrl()` in `libs/email/src/lib/email-assets.ts` - always production, inboxes cannot reach other hosts |

## Adding or replacing an image

1. Drop the file under the matching folder in `public/images/`.
2. If app code needs it, export it from `src/index.ts`.
3. When replacing an image that is referenced by URL, keep the file name (or add a new name and update the reference);
   caches key on the name and external pages may link to it.
