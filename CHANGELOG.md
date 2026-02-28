# Changelog

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

## [8.12.1](///compare/v8.12.0...v8.12.1) (2025-12-12)

### Bug Fixes

* Fix multiple feedback file attachments 22cfa41

## [8.12.0](///compare/v8.11.0...v8.12.0) (2025-12-12)

### Features

* Introduce in-app feedback 2064bc9

# Release Changelog
