/**
 * Emails are read in external mail clients, so every image must be an absolute URL that is publicly reachable -
 * a localhost or staging host renders as a broken image in the recipient's inbox. Images are therefore always
 * served from production, matching both the Cloudinary URLs these replaced and the `baseUrl` default used by the
 * email templates.
 *
 * The files live in libs/shared/assets and are served by the API under /assets/images.
 */
const EMAIL_IMAGE_BASE_URL = 'https://getjetstream.app/assets/images';

/**
 * Part of every email image URL, so bumping it gives newly sent emails a cache key that no CDN or mail-client image
 * proxy has seen. Gmail's proxy keeps a copy for a day and cannot be purged, and neither can the Cloudflare cache on
 * Render's edge - bump this whenever an email image changes or was served corrupted.
 */
const EMAIL_IMAGE_VERSION = '2';

export function getEmailImageUrl(relativePath: string): string {
  return `${EMAIL_IMAGE_BASE_URL}/${relativePath}?v=${EMAIL_IMAGE_VERSION}`;
}
