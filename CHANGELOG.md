# Changelog

## [9.15.0](https://github.com/jetstreamapp/jetstream/compare/v9.14.0...v9.15.0) (2026-04-21)

### Features

* add provider and providerAccountId to session management and token handling ([b05c8fd](https://github.com/jetstreamapp/jetstream/commit/b05c8fdea57292a11d373ab12cb4447634364465))

### Bug Fixes

* add handling for expired access tokens in decryptAccessToken and update tests ([c6c5306](https://github.com/jetstreamapp/jetstream/commit/c6c5306db103352f588da2303ab14290b5bc4f2c))
* add state parameter to OAuth flow for improved security and validation ([9f5520a](https://github.com/jetstreamapp/jetstream/commit/9f5520ae2c61f71ed0482c2e6b81d6b53f10884f))
* enhance error handling in firewall spike detection and improve query structure ([3554c0a](https://github.com/jetstreamapp/jetstream/commit/3554c0a8750bfaa210855b3f6f6123d41d9276d6))
* ensure all user tokens are cleared during session revocation ([7377ca2](https://github.com/jetstreamapp/jetstream/commit/7377ca24ead59efa047dd7ac695ab481b9912521))
* handle undefined field mapping items in LoadRecordsFieldMapping ([132b2f0](https://github.com/jetstreamapp/jetstream/commit/132b2f02e101db4ea1f28a07dce62e46d4922a46))
* improve quick filter functionality in useDataTable to handle invalid regex inputs ([95eac41](https://github.com/jetstreamapp/jetstream/commit/95eac41d0c5c371407276bbbd527ddc078587f5f))
* preserve error context during session-ending errors in verification process ([d3e7eee](https://github.com/jetstreamapp/jetstream/commit/d3e7eee08a8b057ea99ce0d58c0b1a155c3c1d6d))

## [9.14.0](https://github.com/jetstreamapp/jetstream/compare/v9.13.0...v9.14.0) (2026-04-19)

### Features

* add ProfileOrPermSetPopover component and integrate it into various selection components ([0001090](https://github.com/jetstreamapp/jetstream/commit/00010903b2ee802dbc9e225f75ebe17b1ddb1091))
* implement security headers and improve cookie handling; add tests for auth storage privacy ([e113cf0](https://github.com/jetstreamapp/jetstream/commit/e113cf0ec46378c0d3ebf07e013b5ce5b2010ed0))

### Bug Fixes

* add additional sources to CSP directives for enhanced security ([2e434ef](https://github.com/jetstreamapp/jetstream/commit/2e434efcd1094c21860ae19ffec0589ffaa560b9))
* address review feedback - fire-and-forget email sends and fix comment wording ([c524a96](https://github.com/jetstreamapp/jetstream/commit/c524a96edeb4db7bd3a9284d4d8f94582745401d))
* address second round of review feedback on placeholder email suppression ([ce42376](https://github.com/jetstreamapp/jetstream/commit/ce42376eadba34b95346b1f54ba0e6c6c4ccb449))
* suppress verification emails for placeholder sessions in auth flow ([ad1a14e](https://github.com/jetstreamapp/jetstream/commit/ad1a14e8e3765977db941af8c8a63ade0ad300af))
* update CSP policy to include additional image sources and https ([4702c22](https://github.com/jetstreamapp/jetstream/commit/4702c224576b1a5ee8d58b49cde52ff851031b01))

## [9.13.0](https://github.com/jetstreamapp/jetstream/compare/v9.12.1...v9.13.0) (2026-04-19)

### Features

* add automated-scanner routes and session handling for testing purposes ([f1d14fc](https://github.com/jetstreamapp/jetstream/commit/f1d14fc83876388a13a2e32da40a1c1adcda34b7))
* add NameLinkRenderer for clickable record-lookup popover and update column type handling ([43c8c83](https://github.com/jetstreamapp/jetstream/commit/43c8c835cd630178ac608bf2011cb2ce151ea163))
* add redirectIfNotAuthenticatedMiddleware to enforce authentication before accessing app routes ([e6db530](https://github.com/jetstreamapp/jetstream/commit/e6db530c883a0ae9cd3188de1e10d6bf423b2628))
* enable refresh token rotation for salesforce ([1a60190](https://github.com/jetstreamapp/jetstream/commit/1a601904338a4f487af25787c6507d744dc09c07))
* implement verification attempt limits for authentication flows ([fb8a8cb](https://github.com/jetstreamapp/jetstream/commit/fb8a8cb7774537c09491fe46664ea6f21baa30de))
* introduce canvas application ([f0e27ba](https://github.com/jetstreamapp/jetstream/commit/f0e27ba48496425aea860f6e7b09a5e2453452ad))
* introduce jetstream managed package ([c8e9990](https://github.com/jetstreamapp/jetstream/commit/c8e99909e069af4c4e4f37d6af36f4d3d46bd762))
* revoke other sessions on password change to enhance security ([fffc08f](https://github.com/jetstreamapp/jetstream/commit/fffc08f59ab8147598deb2a558be6ce2573a21c8))

### Bug Fixes

* enhance error handling in canvas controller and update fullscreen parameter comment ([25a74be](https://github.com/jetstreamapp/jetstream/commit/25a74bef5d320519ca807252234a47e79045d25f))
* ensure @babel/traverse is on minimum patched version ([a62cedb](https://github.com/jetstreamapp/jetstream/commit/a62cedb9fd68d2d5220f00f895ee009f9c885c35))
* handle placeholder user ID in user activity logging and constants ([bee11b3](https://github.com/jetstreamapp/jetstream/commit/bee11b3d941147d5a40c0bd2619f382389e8e755))
* update release configurations to allow hotfix branches ([f1f265a](https://github.com/jetstreamapp/jetstream/commit/f1f265a7139d7dcc3f3ec6b93e2319eb192286e2))

## [9.12.1](https://github.com/jetstreamapp/jetstream/compare/v9.12.0...v9.12.1) (2026-04-14)

### Features

* add ability to retry failed data loads ([741ff12](https://github.com/jetstreamapp/jetstream/commit/741ff128ba934f90ca45953d5d4c3580ff68ad48))

### Bug Fixes

* add form-action directives to content security policy for third-party redirects ([4bc14f2](https://github.com/jetstreamapp/jetstream/commit/4bc14f2b671ed0a48c77a2fb9a8f87a322d9e8f3))

## [9.12.0](https://github.com/jetstreamapp/jetstream/compare/v9.11.0...v9.12.0) (2026-04-14)

### Features

* enhance bulk API error handling and add polling mechanism ([5be2ad7](https://github.com/jetstreamapp/jetstream/commit/5be2ad711eeda7c765f7b5f420af3f2917ec1971))
* enhance CSP and server setup with nonce support and worker management improvements ([a126f33](https://github.com/jetstreamapp/jetstream/commit/a126f33302d8309862d2c44caff73696456bf9c7))
* monitor waf traffic via cron job ([d96a631](https://github.com/jetstreamapp/jetstream/commit/d96a6317e31d4917050c8242cc5ba86595eae3fe))

### Bug Fixes

* adjust updatedAt calculation in user sync records generation test ([e3fdd77](https://github.com/jetstreamapp/jetstream/commit/e3fdd7700ef1430e080bd4db697848a6e5b1d739))
* correct typo in comment for batch processing in loadBulkApiData ([aff3c3b](https://github.com/jetstreamapp/jetstream/commit/aff3c3ba1f8f8cd63fe30dd94bb458786b9dc731))
* improve jobInfo and intervalCount state updates in LoadRecordsBulkApiResults ([8709f54](https://github.com/jetstreamapp/jetstream/commit/8709f54850d76d192f7ae4c0bfd9b5f1f87d6269))
* update web extension asset path to public directory ([73d8c65](https://github.com/jetstreamapp/jetstream/commit/73d8c656da8b5cc23cdefbb07c8da3c8663f623c))

## [9.11.0](https://github.com/jetstreamapp/jetstream/compare/v9.10.0...v9.11.0) (2026-04-11)

### Features

* implement JWT token rotation for desktop and web extension authentication ([d04b6a0](https://github.com/jetstreamapp/jetstream/commit/d04b6a0b787eaa6b1f972ee6131410f86c612701))

### Bug Fixes

* correct isFieldSubquery and fieldMetadataSubquery lookups in data-table-utils ([fd7669a](https://github.com/jetstreamapp/jetstream/commit/fd7669a1b9c420c499d1ada8ed66c57a3e8b4593))
* **create-fields:** enhance error handling by displaying detailed import errors ([09c3325](https://github.com/jetstreamapp/jetstream/commit/09c3325acb5bb7b30c74edcd8a6e8f1d9641dd2d)), closes [#1638](https://github.com/jetstreamapp/jetstream/issues/1638)
* enhance subquery processing by tracking missing relationships in metadata ([08c16a8](https://github.com/jetstreamapp/jetstream/commit/08c16a8b62c22d274ea061de23bdc217f9a8c4cc))
* improve handling of subquery fields and refactor query column mapping ([f0f341f](https://github.com/jetstreamapp/jetstream/commit/f0f341f927b4827540b7d47478405bb74acb66a6))
* replace any[] with FieldValues[] and remove unnecessary eslint-disable comment in CreateFieldsImportExport ([20c99c0](https://github.com/jetstreamapp/jetstream/commit/20c99c070f43ffe03a541459f36f2160e44bc098))
* use Partial<Record<FieldDefinitionType, FieldValue>>[] for exportData state and type getRowsForExport accumulator ([790ebe3](https://github.com/jetstreamapp/jetstream/commit/790ebe3de950a212a6daa0159a1fd7bf07ec2c31))

## [9.10.0](https://github.com/jetstreamapp/jetstream/compare/v9.9.1...v9.10.0) (2026-04-08)

### Features

* **create-fields:** add LoadExistingFieldsModal and integrate field loading functionality ([b94edf9](https://github.com/jetstreamapp/jetstream/commit/b94edf9c00c3cc3ae42a68dd9d6bfbe9ac5fb491)), closes [#1636](https://github.com/jetstreamapp/jetstream/issues/1636)
* **csp:** add Cloudflare Web Analytics beacon inline script to CSP ([d9fc355](https://github.com/jetstreamapp/jetstream/commit/d9fc355b45f0622796cbd085b1482b1445c08b19))
* **load-records:** add context menu actions and clipboard functionality for duplicate records table ([750d46a](https://github.com/jetstreamapp/jetstream/commit/750d46afa9a87be1c2698db9ef414c3dfbbcd9dd)), closes [#1635](https://github.com/jetstreamapp/jetstream/issues/1635)
* **query-history:** update mouse wheel handling logic for scrollbar ([b124350](https://github.com/jetstreamapp/jetstream/commit/b1243509848f730d152f8d189a94285519f6ea46)), closes [#1502](https://github.com/jetstreamapp/jetstream/issues/1502)
* **sobject-export:** add 'Description' field to export selections and definitions ([53d20b5](https://github.com/jetstreamapp/jetstream/commit/53d20b5eacece7bad715032c17ae30dada7cfe54))

### Bug Fixes

* **create-fields:** enhance error handling by displaying detailed import errors ([1ac867b](https://github.com/jetstreamapp/jetstream/commit/1ac867b643c4134ca5304e288d738e2988963ecf)), closes [#1638](https://github.com/jetstreamapp/jetstream/issues/1638)
* **dependencies:** update fast-jwt to version 6.2.0 ([3eaaf54](https://github.com/jetstreamapp/jetstream/commit/3eaaf540f31d819e8c32d34bd97d9627d881dcfc))
* **email:** fix toLocaleString runtime error, severity badge mismatch, and move style constants ([69f3816](https://github.com/jetstreamapp/jetstream/commit/69f381620722cc89d893559ff05821f200514798))
* **getDeployMetadataFromComparisonTree:** filter out null metadata items ([656a871](https://github.com/jetstreamapp/jetstream/commit/656a8716724472de683f58157b136e99c49e15d7))

## [9.9.1](https://github.com/jetstreamapp/jetstream/compare/v9.9.0...v9.9.1) (2026-04-05)

### Features

* **security:** add Cloudflare Insights to CSP script sources ([0fc90c9](https://github.com/jetstreamapp/jetstream/commit/0fc90c9f95449575b2a0bc5e76ce99d370b36841))

### Bug Fixes

* **landing:** update SSO blog post link to use correct route ([56002cf](https://github.com/jetstreamapp/jetstream/commit/56002cff5c745b2e34d37e316d990aa5b2d0a5bd))

## [9.9.0](https://github.com/jetstreamapp/jetstream/compare/v9.8.1...v9.9.0) (2026-04-04)

### Features

* **api:** implement deferred response middleware for long-running requests ([c936fe9](https://github.com/jetstreamapp/jetstream/commit/c936fe959fecf6b314e52795b9f939a2b6ff0ef2))

## [9.8.1](https://github.com/jetstreamapp/jetstream/compare/v9.8.0...v9.8.1) (2026-04-04)

### Bug Fixes

* add empty data object to resendInvitation API request ([ea25480](https://github.com/jetstreamapp/jetstream/commit/ea254804e5b8556fb3545846ed3b0674e2b30c4b))
* change bot route status code from 403 to 444 ([1806360](https://github.com/jetstreamapp/jetstream/commit/18063606d98a5a7178dc0b6bf95a525d2ba136f2))

## [9.8.0](https://github.com/jetstreamapp/jetstream/compare/v9.7.0...v9.8.0) (2026-04-03)

### Features

* add IdP-initiated OIDC login support and update documentation ([162f127](https://github.com/jetstreamapp/jetstream/commit/162f1276d9d217686095461f04c253409418c29b))

### Bug Fixes

* handle invalid SOQL syntax gracefully by ignoring formatting errors ([fc6882a](https://github.com/jetstreamapp/jetstream/commit/fc6882a8080f8620cefdaa079a0c5bf8255904a7))
* remove unnecessary server root configuration from Rollbar setup ([9540522](https://github.com/jetstreamapp/jetstream/commit/95405227905b123f351478c0ef2951e6fb4501a3))
* **ui:** correct aria-expanded in Section and add keyboard focus assertions ([3c1f581](https://github.com/jetstreamapp/jetstream/commit/3c1f5810ea4008e3dee69835cf9aefff83a3d3c7))

## [9.7.0](https://github.com/jetstreamapp/jetstream/compare/v9.6.0...v9.7.0) (2026-04-02)

### Features

* update Terms of Service with new LastUpdated date and add compliance reporting information ([b2661ed](https://github.com/jetstreamapp/jetstream/commit/b2661eddbd88988458d5882c11e8b68f18579710))

## [9.6.0](https://github.com/jetstreamapp/jetstream/compare/v9.5.0...v9.6.0) (2026-04-02)

### Features

* replace fast-xml-parser and fast-xml-builder with @jetstreamapp/simple-xml for XML parsing and building ([2db670a](https://github.com/jetstreamapp/jetstream/commit/2db670ad888be7d3add2243e42e932da365c7783))

### Bug Fixes

* simplify fetchUserProfile error handling to return DEFAULT_PROFILE on failure ([fda5665](https://github.com/jetstreamapp/jetstream/commit/fda5665510da26ee63e8f3ecc1b5c04ed6b6f514))

## [9.5.0](https://github.com/jetstreamapp/jetstream/compare/v9.4.1...v9.5.0) (2026-04-01)

### Features

* enhance persistence service with logging and improved app data handling ([11fd29f](https://github.com/jetstreamapp/jetstream/commit/11fd29f98464178bd77d5a6a6f9d76d29d59ee6d))
* Replace formulon with sf-formula-parser for formula evaluation ([3abab4d](https://github.com/jetstreamapp/jetstream/commit/3abab4d87e76a1d4a72aacbc49ea461df0e3fadd))

## [9.4.1](https://github.com/jetstreamapp/jetstream/compare/v9.4.0...v9.4.1) (2026-03-31)

### Features

* enhance geo-IP functionality with improved data structures and error handling ([adc6456](https://github.com/jetstreamapp/jetstream/commit/adc6456b5ab4be121aec5d514b8d312ec4677888))
* use jwt auth for e2e org ([b34e07e](https://github.com/jetstreamapp/jetstream/commit/b34e07e060b1e5bab28e5b78f1ed3f0f25274b56))

### Bug Fixes

* handle empty body in Salesforce API request ([49aafb6](https://github.com/jetstreamapp/jetstream/commit/49aafb6cfc2974ec7caa9c5d2f37bc7ef90727e5))
* orgs and groups not showing in desktop app ([2d543af](https://github.com/jetstreamapp/jetstream/commit/2d543af4babb9ead5eccfde5dc26f01c7ad91bb3)), closes [#1615](https://github.com/jetstreamapp/jetstream/issues/1615)
* update apex test and disable entity processing in XML parsing ([cfcc664](https://github.com/jetstreamapp/jetstream/commit/cfcc6645c5f0ddf52074fed6118e5a7a3f18a83f))
* update Rollbar token environment variable in release workflow ([f9f5eba](https://github.com/jetstreamapp/jetstream/commit/f9f5eba9ded0df595fb3d7121f79b8bd73425fdf))
* upgrade vulnerable dependencies ([3fb3449](https://github.com/jetstreamapp/jetstream/commit/3fb344929e81cc0248de797ba2792d7b3f8d1bcd))

## [9.4.0](https://github.com/jetstreamapp/jetstream/compare/v9.3.0...v9.4.0) (2026-03-27)

### Features

* add keyboard navigation to FeedbackWidget context menu ([#1532](https://github.com/jetstreamapp/jetstream/issues/1532)) ([07eb45e](https://github.com/jetstreamapp/jetstream/commit/07eb45e2520a7ab298b8ff525e3480d4c49d063f))
* enhance geo-IP utilities and email summary with distance calculations and multi-IP session checks ([71e1fd7](https://github.com/jetstreamapp/jetstream/commit/71e1fd793c95a5110ca98042973e8a94be894327))
* implement external google drive picker integration ([ac92aa3](https://github.com/jetstreamapp/jetstream/commit/ac92aa35845e4107ec67a1247fe1072b8b5bf976))

### Bug Fixes

* sfdx change tracking after creating new fields with permissions ([c9ddc03](https://github.com/jetstreamapp/jetstream/commit/c9ddc031f0258383f8b679667d030a4162dcfa6a)), closes [#1587](https://github.com/jetstreamapp/jetstream/issues/1587)

## [9.3.0](https://github.com/jetstreamapp/jetstream/compare/v9.2.0...v9.3.0) (2026-03-20)

### Features

* **auth:** implement Terms of Service acceptance flow ([b2a0888](https://github.com/jetstreamapp/jetstream/commit/b2a0888f950d7365ec3d83a0e2b4ed6eb1b963fd))

### Bug Fixes

* implement per-user encryption for desktop org data ([283760d](https://github.com/jetstreamapp/jetstream/commit/283760d4fd25d80bb04093b1de0d35241235ff58)), closes [#1595](https://github.com/jetstreamapp/jetstream/issues/1595)

## [9.2.0](https://github.com/jetstreamapp/jetstream/compare/v9.1.0...v9.2.0) (2026-03-13)

### Features

* refresh landing page ([4bd2d60](https://github.com/jetstreamapp/jetstream/commit/4bd2d601be50672d196a865727253545ac7a3bd7))

### Bug Fixes

* avoid interpolation in ci commands ([b0a8e24](https://github.com/jetstreamapp/jetstream/commit/b0a8e2413c2ff593b16448379401b49f0bd568c9))
* correct malformed urls and unlinked commit references in changelog.md ([7edcfa0](https://github.com/jetstreamapp/jetstream/commit/7edcfa095c4bcf8346c6907e7eacb665fcf72f6b))

## [9.1.0](https://github.com/jetstreamapp/jetstream/compare/v9.0.1...v9.1.0) (2026-03-08)

### Features

* implement text sanitization for pasted content in editors ([66680e7](https://github.com/jetstreamapp/jetstream/commit/66680e7518a6c804b873bd1946a01c3f544ad542))

### Bug Fixes

* cancel in-flight ci jobs on prs ([1b1d15f](https://github.com/jetstreamapp/jetstream/commit/1b1d15f368c852654f6b12b97c08faa4a304b1d8))
* fix api tests after hyperforce migration ([2900a16](https://github.com/jetstreamapp/jetstream/commit/2900a1621db9376c085344dbeaae6a5813affc69))
* fix duplicated getstorage check ([f6d0a5a](https://github.com/jetstreamapp/jetstream/commit/f6d0a5af7c245e4ac564602ca0918bb62072aacf))
* fix editor line number reset position ([f634dd0](https://github.com/jetstreamapp/jetstream/commit/f634dd040c9403c35e58d5f1c37acb636762e0f4))
* fix error message and loading state ([7439dcc](https://github.com/jetstreamapp/jetstream/commit/7439dcc596edfae05d765002f114319b7378a4c2))
* fix invalid export path ([f690d2d](https://github.com/jetstreamapp/jetstream/commit/f690d2dce6e389a08c8f05c5fbb4ff8615aaae12))
* fix invalid icon types ([ca66298](https://github.com/jetstreamapp/jetstream/commit/ca6629894f8281d9d0e47f4fe29f61a00ccc54ed))
* fix malformed ids ([ccc8862](https://github.com/jetstreamapp/jetstream/commit/ccc886267189ccc26a9f1b1d5321cceddf079ea1))
* handle errors in stream processing ([68e7033](https://github.com/jetstreamapp/jetstream/commit/68e7033e2c22c1e1472aa87e0ecb0c9ddee432e8))
* show actual error on bulk update failure ([2e4b70c](https://github.com/jetstreamapp/jetstream/commit/2e4b70c854ba4ded4a921b146cae4ab36ab3a17c))

## [9.0.1](https://github.com/jetstreamapp/jetstream/compare/v9.0.0...v9.0.1) (2026-02-28)

## [9.0.0](https://github.com/jetstreamapp/jetstream/compare/v8.25.0...v9.0.0) (2026-02-27)

### Features

* add persisted cache provider for saml + others ([e72546e](https://github.com/jetstreamapp/jetstream/commit/e72546ef6ba1c726b6d7f33bab811424196b6a23))
* add SSO support with SAML and OIDC configurations ([11fcba7](https://github.com/jetstreamapp/jetstream/commit/11fcba7f22b57889290aa5def73f54e21381265e))
* **docs:** implement saml and oidc sso ([cf3c5c0](https://github.com/jetstreamapp/jetstream/commit/cf3c5c03acb6c6d19f0aa1ff7291d88331d56af4))
* improve sso login form ([342a730](https://github.com/jetstreamapp/jetstream/commit/342a730e26509ca536c519fc1864375d02a8d421))

### Bug Fixes

* add totp grace period ([aba04a7](https://github.com/jetstreamapp/jetstream/commit/aba04a75cdc4ac999e563dc40093d83ef22f6bd3))
* ensure package name is encoded ([9f2bf5c](https://github.com/jetstreamapp/jetstream/commit/9f2bf5c238eebbb04dee8d1168035f1be12d8f27))
* improve cookie banner dismissal in e2e tests ([e8264de](https://github.com/jetstreamapp/jetstream/commit/e8264de282cf6b770c6ac57390f69165198abd71))

## [8.25.0](https://github.com/jetstreamapp/jetstream/compare/v8.24.0...v8.25.0) (2026-02-19)

### Features

* **browser-extension:** add quick record view ([d4330f5](https://github.com/jetstreamapp/jetstream/commit/d4330f5a815f82efe3a924e6f97d2e464eb30972))

### Bug Fixes

* **browser-extension:** fix browser extension state ([a541fea](https://github.com/jetstreamapp/jetstream/commit/a541fead0d9360438faeb90e80d721f672482a04)), closes [#1549](https://github.com/jetstreamapp/jetstream/issues/1549)
* **web-extension:** improve view/edit current record ([880150b](https://github.com/jetstreamapp/jetstream/commit/880150bcc18302b29cfae7b29f4c216d34ec5e8c))

## [8.24.0](https://github.com/jetstreamapp/jetstream/compare/v8.23.1...v8.24.0) (2026-02-17)

### Features

* add warning icon for invalid metadata audit info ([0820d9d](https://github.com/jetstreamapp/jetstream/commit/0820d9d8114b779bd98ead0c92465a7b599def21))
* inject last modified date to custom metadata records ([5468a7e](https://github.com/jetstreamapp/jetstream/commit/5468a7ea791a41a363ac075c0810e60a2fef9860)), closes [#1544](https://github.com/jetstreamapp/jetstream/issues/1544)
* remember google folder selection ([e13115a](https://github.com/jetstreamapp/jetstream/commit/e13115aa38d8f785a241438d5db4fe663381dd55))

### Bug Fixes

* fix automation control in orgs with namespace ([91fa3f7](https://github.com/jetstreamapp/jetstream/commit/91fa3f7eddd1647fc27be951504477c7f4b7946a))

## [8.23.1](https://github.com/jetstreamapp/jetstream/compare/v8.23.0...v8.23.1) (2026-02-13)

### Bug Fixes

* manage permission export to google fix ([c67fb77](https://github.com/jetstreamapp/jetstream/commit/c67fb775fa2bdfe3d844bf0545a43b9af892204a)), closes [#1541](https://github.com/jetstreamapp/jetstream/issues/1541)

## [8.23.0](https://github.com/jetstreamapp/jetstream/compare/v8.22.0...v8.23.0) (2026-02-12)

### Features

* better handling of audit fields when creating records ([419b7d3](https://github.com/jetstreamapp/jetstream/commit/419b7d347b194fdc7a54d87a4c4e968c8dca1854)), closes [#1536](https://github.com/jetstreamapp/jetstream/issues/1536)

### Bug Fixes

* fix error boundary after upgrade ([c7afc1d](https://github.com/jetstreamapp/jetstream/commit/c7afc1d5c7bc851340e6e1fc1de7ab79b9a3319e))
* keyboard navigation for lookup combobox ([0428958](https://github.com/jetstreamapp/jetstream/commit/0428958e56806175a5759e5cf370c31b5e044c3e)), closes [#1535](https://github.com/jetstreamapp/jetstream/issues/1535)

## [8.22.0](https://github.com/jetstreamapp/jetstream/compare/v8.21.0...v8.22.0) (2026-02-09)

### Features

* auto-select org when changing groups ([5c02120](https://github.com/jetstreamapp/jetstream/commit/5c021205375076aaad4d711387cdb6ada9ad3a44)), closes [#1434](https://github.com/jetstreamapp/jetstream/issues/1434)

## [8.21.0](https://github.com/jetstreamapp/jetstream/compare/v8.20.0...v8.21.0) (2026-02-07)

### Features

* improve feedback widget ([5ae0ba8](https://github.com/jetstreamapp/jetstream/commit/5ae0ba8373e0fc8005eaa665c0535439900af9af)), closes [#1528](https://github.com/jetstreamapp/jetstream/issues/1528)
* increase api limit for data loads ([d5c044c](https://github.com/jetstreamapp/jetstream/commit/d5c044ce5000698330df7d6c9b3fb5b2c3a3454c)), closes [#1521](https://github.com/jetstreamapp/jetstream/issues/1521)
* increase download limit for file attachments ([230efd2](https://github.com/jetstreamapp/jetstream/commit/230efd26e194334a93ffad723042eb5b4615db0d)), closes [#1527](https://github.com/jetstreamapp/jetstream/issues/1527)

### Bug Fixes

* retain permission manager filter text on tab change ([d913068](https://github.com/jetstreamapp/jetstream/commit/d913068a5061fbae54689f477e3e3434f2e32966)), closes [#1525](https://github.com/jetstreamapp/jetstream/issues/1525)

## [8.20.0](https://github.com/jetstreamapp/jetstream/compare/v8.19.2...v8.20.0) (2026-02-03)

### Bug Fixes

* improve permission export download ([b46454a](https://github.com/jetstreamapp/jetstream/commit/b46454a9c05e845dab5b1de1091efeb34690864d)), closes [#1522](https://github.com/jetstreamapp/jetstream/issues/1522)

## [8.19.2](https://github.com/jetstreamapp/jetstream/compare/v8.19.1...v8.19.2) (2026-02-02)

## [8.19.1](https://github.com/jetstreamapp/jetstream/compare/v8.19.0...v8.19.1) (2026-01-23)

### Bug Fixes

* field permissions missing correct values ([e87a33a](https://github.com/jetstreamapp/jetstream/commit/e87a33ae2e04e6bf8aed2f75d3baa866dbe85fe8)), closes [#1513](https://github.com/jetstreamapp/jetstream/issues/1513)

## [8.19.0](https://github.com/jetstreamapp/jetstream/compare/v8.18.1...v8.19.0) (2026-01-23)

## [8.18.1](https://github.com/jetstreamapp/jetstream/compare/v8.18.0...v8.18.1) (2026-01-23)

### Bug Fixes

* remove email preview ([7556bcd](https://github.com/jetstreamapp/jetstream/commit/7556bcda521240f40b3401749435621317448c28))

## [8.18.0](https://github.com/jetstreamapp/jetstream/compare/v8.17.1...v8.18.0) (2026-01-20)

### Features

* show preview of zip file on data loads ([33b76f4](https://github.com/jetstreamapp/jetstream/commit/33b76f43c25c6b5545538f03f0d163227330482c))

### Bug Fixes

* add team-management page to docs ([179331f](https://github.com/jetstreamapp/jetstream/commit/179331f5015fc657646d5c965c8d4b76ea139326))
* **api:** handle aborted download job ([1b64de5](https://github.com/jetstreamapp/jetstream/commit/1b64de588a3c57bbdc6e464869158c749550e451))
* mark record as error if missing binary attachment ([451954e](https://github.com/jetstreamapp/jetstream/commit/451954ed44e15537c04a0afde50164010cc3975a)), closes [#1503](https://github.com/jetstreamapp/jetstream/issues/1503)

## [8.17.1](https://github.com/jetstreamapp/jetstream/compare/v8.17.0...v8.17.1) (2026-01-15)

### Bug Fixes

* manage permission invalid id ([610080d](https://github.com/jetstreamapp/jetstream/commit/610080d9c032b84b709738b402cd017283a9515b)), closes [#1504](https://github.com/jetstreamapp/jetstream/issues/1504)

## [8.17.0](https://github.com/jetstreamapp/jetstream/compare/v8.16.0...v8.17.0) (2026-01-12)

### Features

* **desktop:** add menu option to open recent log file ([35d4c7a](https://github.com/jetstreamapp/jetstream/commit/35d4c7a36cd85387aceeb7731bc1df6dda87bf97))
* **desktop:** add menu option to open settings ([fd39313](https://github.com/jetstreamapp/jetstream/commit/fd39313bf9b6b76897b8403d74ebf0ecbe786c3e))
* **desktop:** show recent files in menu ([139d333](https://github.com/jetstreamapp/jetstream/commit/139d3332e4c666aa5de6d59aff3ec8750dbceb4c))
* **desktop:** show recent files in menu ([9f03030](https://github.com/jetstreamapp/jetstream/commit/9f0303076657fbaee1812eef52718fcfeba72300))

### Bug Fixes

* **desktop:** disable logging in dev mode ([f704ff0](https://github.com/jetstreamapp/jetstream/commit/f704ff0e9514968cc8f52120948d5126809e15cc))
* **desktop:** fix bulk API query download ([fa91968](https://github.com/jetstreamapp/jetstream/commit/fa91968904d073d0c0b4fb2bf8d7dd035b06a3e8))
* **desktop:** fix desktop open org link ([15afc27](https://github.com/jetstreamapp/jetstream/commit/15afc271267ec5388dbfd563978e44d6aff769c8))
* **desktop:** increase heap memory for electron ([e1133ad](https://github.com/jetstreamapp/jetstream/commit/e1133ad40367e7ea3f023220f7c9e4d005e4a299))
* **desktop:** unsubscribe to electron callbacks ([7febf9b](https://github.com/jetstreamapp/jetstream/commit/7febf9b33bf2f40ad6fc7761b22a56f9829f08ea))
* handle large xlsx files ([d940488](https://github.com/jetstreamapp/jetstream/commit/d9404882ddb10222f921848ef6522cf6a3db8e58))

## [8.16.0](https://github.com/jetstreamapp/jetstream/compare/v8.15.1...v8.16.0) (2026-01-02)

### Features

* add delete button to org card ([81e3504](https://github.com/jetstreamapp/jetstream/commit/81e35042b0e6f54af3b2e8a457cbd667a4665a9d))
* **desktop:** show org connection error on desktop ([0ec59c0](https://github.com/jetstreamapp/jetstream/commit/0ec59c0fdc299f46c1b2f0f49b24fe14d2c1248d))
* enable team dashboard in desktop app ([3a80f5d](https://github.com/jetstreamapp/jetstream/commit/3a80f5dc3a513d10995a01d4066bfec2410bac05))

### Bug Fixes

* change load static field dropdown styles ([4c4e576](https://github.com/jetstreamapp/jetstream/commit/4c4e57651edd9e69f6b5ddfae21944345d8f05a8))
* error message typo ([d7770c3](https://github.com/jetstreamapp/jetstream/commit/d7770c363b57d5b3f096d23aab4d37f6bc4c70a6))
* incorrect openapi route method ([f1e355c](https://github.com/jetstreamapp/jetstream/commit/f1e355c5559d5e7238fd190bdff837de59b9b5b6))
* redirect url validation ([e31e980](https://github.com/jetstreamapp/jetstream/commit/e31e980753ffdd371ee7d5a99f7817ffb17ac2d9))

## [8.15.1](https://github.com/jetstreamapp/jetstream/compare/v8.15.0...v8.15.1) (2025-12-23)

### Features

* **load:** add hard delete option to load records ([36d16da](https://github.com/jetstreamapp/jetstream/commit/36d16da3a1252050b0d5bff3a594cd0b9ff12075)), closes [#1447](https://github.com/jetstreamapp/jetstream/issues/1447)

### Bug Fixes

* ensure space does not scroll picklist menu ([94438ac](https://github.com/jetstreamapp/jetstream/commit/94438acead4cf4e68edf35b9d18c357bd279dd05))
* **query:** data table editor lookup editor ([360312b](https://github.com/jetstreamapp/jetstream/commit/360312bb417989b077b2180e67c2ee5a2ce689fd)), closes [#1483](https://github.com/jetstreamapp/jetstream/issues/1483)

## [8.15.0](https://github.com/jetstreamapp/jetstream/compare/v8.14.0...v8.15.0) (2025-12-16)

### Features

* add user configurable soql format options ([993fa8c](https://github.com/jetstreamapp/jetstream/commit/993fa8c80932d8b556767fb5d814101e68971252)), closes [#1472](https://github.com/jetstreamapp/jetstream/issues/1472)

### Bug Fixes

* desktop build editor assets ([ceaf863](https://github.com/jetstreamapp/jetstream/commit/ceaf86345dd5dcda0b10e9953458c551247eb7c6))

## [8.14.0](https://github.com/jetstreamapp/jetstream/compare/v8.13.1...v8.14.0) (2025-12-14)

### Features

* add record lookup to query filter value ([60154a9](https://github.com/jetstreamapp/jetstream/commit/60154a95e06b750a7c23c4046f503e287508f65a)), closes [#1463](https://github.com/jetstreamapp/jetstream/issues/1463)

### Bug Fixes

* record lookup clear button ([ed4ce71](https://github.com/jetstreamapp/jetstream/commit/ed4ce716c0514dd05966218ac316b5bf7034a1f6)), closes [#1471](https://github.com/jetstreamapp/jetstream/issues/1471)

## [8.13.1](https://github.com/jetstreamapp/jetstream/compare/v8.13.0...v8.13.1) (2025-12-13)

### Bug Fixes

* lookup filter styles ([41e6674](https://github.com/jetstreamapp/jetstream/commit/41e6674b0a363744c67e42e4b385f956b0459418)), closes [#1471](https://github.com/jetstreamapp/jetstream/issues/1471)

## [8.13.0](https://github.com/jetstreamapp/jetstream/compare/v8.12.1...v8.13.0) (2025-12-13)

### Features

* add lookup field for editing reference fields ([63d5d72](https://github.com/jetstreamapp/jetstream/commit/63d5d72442de407768df876a9cb87e5447eec813)), closes [#1471](https://github.com/jetstreamapp/jetstream/issues/1471)

### Bug Fixes

* fix accessibility issues ([28ff1aa](https://github.com/jetstreamapp/jetstream/commit/28ff1aa102f2df50186da0ec696a7a594eb510a9))

## [8.12.1](https://github.com/jetstreamapp/jetstream/compare/v8.12.0...v8.12.1) (2025-12-12)

### Bug Fixes

* Fix multiple feedback file attachments ([22cfa41](https://github.com/jetstreamapp/jetstream/commit/22cfa41))

## [8.12.0](https://github.com/jetstreamapp/jetstream/compare/v8.11.0...v8.12.0) (2025-12-12)

### Features

* Introduce in-app feedback ([2064bc9](https://github.com/jetstreamapp/jetstream/commit/2064bc9))

# Release Changelog
