/**
 * Emails are read in external mail clients, so every image must be an absolute URL that is publicly reachable -
 * a localhost or staging host renders as a broken image in the recipient's inbox. Images are therefore always
 * served from production, matching both the Cloudinary URLs these replaced and the `baseUrl` default used by the
 * email templates.
 *
 * The files live in libs/shared/assets and are served by the API under /assets/images.
 */
const EMAIL_IMAGE_BASE_URL = 'https://getjetstream.app/assets/images';

export function getEmailImageUrl(relativePath: string): string {
  return `${EMAIL_IMAGE_BASE_URL}/${relativePath}`;
}
