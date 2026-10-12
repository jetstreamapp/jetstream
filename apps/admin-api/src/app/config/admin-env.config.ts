import { ENV, logger } from '@jetstream/api-config';
import { z } from 'zod';

const commaSeparatedEmails = z
  .string()
  .min(1)
  .transform((value) =>
    value
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  )
  .pipe(z.array(z.email()).min(1));

/**
 * Admin-only settings, layered on top of the shared Jetstream env from `@jetstream/api-config`
 * (database, Stripe, email). Validated once at startup so a misconfigured deploy fails to boot
 * instead of running with weakened auth.
 */
const AdminEnvSchema = z
  .object({
    ADMIN_API_PORT: z.coerce.number().int().default(3335),
    /** Public origin of the admin app; the OAuth redirect URI and cookie security derive from it */
    ADMIN_BASE_URL: z.url().default('http://localhost:4203'),
    ADMIN_GOOGLE_CLIENT_ID: z.string().min(1),
    ADMIN_GOOGLE_CLIENT_SECRET: z.string().min(1),
    ADMIN_SESSION_SECRET: z.string().min(32),
    ADMIN_SESSION_HOURS: z.coerce.number().int().min(1).max(24).default(12),
    /** Google Workspace domain every admin account must belong to (checked against the `hd` claim) */
    ADMIN_ALLOWED_DOMAIN: z.string().trim().toLowerCase().min(1).default('getjetstream.app'),
    ADMIN_ALLOWED_EMAILS: commaSeparatedEmails,
    /** Cloudflare Access team domain, e.g. `jetstream.cloudflareaccess.com`. Set with the AUD to require Access */
    ADMIN_CF_ACCESS_TEAM_DOMAIN: z.string().trim().optional(),
    ADMIN_CF_ACCESS_AUD: z.string().trim().optional(),
  })
  .superRefine((value, ctx) => {
    const outsideDomain = value.ADMIN_ALLOWED_EMAILS.filter((email) => !email.endsWith(`@${value.ADMIN_ALLOWED_DOMAIN}`));
    if (outsideDomain.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['ADMIN_ALLOWED_EMAILS'],
        message: `Every allowed email must belong to ${value.ADMIN_ALLOWED_DOMAIN}: ${outsideDomain.join(', ')}`,
      });
    }
    if (!!value.ADMIN_CF_ACCESS_TEAM_DOMAIN !== !!value.ADMIN_CF_ACCESS_AUD) {
      ctx.addIssue({
        code: 'custom',
        path: ['ADMIN_CF_ACCESS_AUD'],
        message: 'ADMIN_CF_ACCESS_TEAM_DOMAIN and ADMIN_CF_ACCESS_AUD must be set together',
      });
    }
    if (ENV.ENVIRONMENT === 'production' && !value.ADMIN_BASE_URL.startsWith('https://')) {
      ctx.addIssue({ code: 'custom', path: ['ADMIN_BASE_URL'], message: 'ADMIN_BASE_URL must use https in production' });
    }
  });

function parseAdminEnv() {
  const result = AdminEnvSchema.safeParse(process.env);
  if (!result.success) {
    logger.error({ issues: z.treeifyError(result.error) }, '[ADMIN] Invalid admin environment configuration');
    process.exit(1);
  }
  const baseUrl = new URL(result.data.ADMIN_BASE_URL);
  return {
    ...result.data,
    ADMIN_BASE_URL: baseUrl.origin,
    allowedEmails: new Set(result.data.ADMIN_ALLOWED_EMAILS),
    useSecureCookies: baseUrl.protocol === 'https:',
    cloudflareAccessEnabled: !!result.data.ADMIN_CF_ACCESS_TEAM_DOMAIN && !!result.data.ADMIN_CF_ACCESS_AUD,
  };
}

export const ADMIN_ENV = parseAdminEnv();
