/**
 * Single source of truth for Jetstream's static images (logos, favicons, marketing screenshots, email icons,
 * third-party marks). See libs/shared/assets/README.md for the layout and how each app consumes it.
 *
 * Everything exported from here is resolved by the bundler (Vite: web app, desktop client, browser extension)
 * and evaluates to a URL string at runtime, so it works offline and needs no img-src CSP entry.
 *
 * Every file under `public/images` is ALSO served by the API at `/assets/images/<path>`
 * (https://getjetstream.app/assets/images/<path> in production). Use that URL form from anything that cannot go
 * through a bundler: emails, server-side JSON responses, the landing site and the docs site.
 */
export { default as jetstreamSampleNotificationUrl } from '../public/images/app/jetstream-sample-notification.png';
export { default as jetstreamLogoProUrl } from '../public/images/jetstream-logo-pro-200w.png';
export { default as jetstreamLogoUrl } from '../public/images/jetstream-logo-v1-200w.png';
export * from './sfdc-object-icons';
