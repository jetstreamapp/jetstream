import { AUTH_ERROR_MESSAGES } from '@jetstream/shared/constants';

export const ENVIRONMENT = {
  BILLING_ENABLED: process.env.NX_PUBLIC_BILLING_ENABLED === 'true',
  CLIENT_URL: process.env.NX_PUBLIC_CLIENT_URL || 'https://getjetstream.app/app',
  SERVER_URL: process.env.NX_PUBLIC_SERVER_URL || 'https://getjetstream.app',
  CAPTCHA_KEY: process.env.NX_PUBLIC_CAPTCHA_KEY || null,
};

export const ROUTES = {
  HOME: '/',
  ABOUT: '/about',
  BLOG: '/blog',
  blogPost: (slug: string) => `/blog/post/${slug}`,
  PRIVACY: '/privacy',
  TERMS_OF_SERVICE: '/terms-of-service',
  SUB_PROCESSORS: '/subprocessors',
  DPA: '/dpa',
  DESKTOP: '/desktop-app',
  BROWSER_EXTENSIONS: '/browser-extensions',
  PRICING: '/pricing',
  EXTERNAL: {
    DOCS: 'https://docs.getjetstream.app',
    STATUS: 'https://status.getjetstream.app',
    SUPPORT_EMAIL: 'mailto:support@getjetstream.app',
    DISCORD: 'https://discord.gg/sfxd',
    GITHUB_ISSUE: 'https://github.com/jetstreamapp/jetstream/issues',
    GITHUB_SPONSOR: 'https://github.com/sponsors/jetstreamapp',
    CHROME_EXTENSION: 'https://chromewebstore.google.com/detail/jetstream/nhahnhcpbhlkmpkdgbbadffnhblhlomm',
    FIREFOX_EXTENSION: 'https://addons.mozilla.org/en-US/firefox/addon/jetstreamapp',
  },
  AUTH: {
    _root_path: '/auth/',
    login: '/auth/login/',
    signup: '/auth/signup/',
    resetPassword: '/auth/password-reset',
    resetPasswordVerify: '/auth/password-reset/verify',
    verify: `/auth/verify`,
    api_csrf: `/api/auth/csrf`,
    api_logout: `/api/auth/logout`,
    api_otp_enroll: `/api/auth/2fa-otp/enroll`,
    api_providers: `/api/auth/providers`,
    api_session: `/api/auth/session`,
    api_verify: `/api/auth/verify`,
    api_verify_resend: `/api/auth/verify/resend`,
    api_reset_password_init: `/api/auth/password/reset/init`,
    api_reset_password_verify: `/api/auth/password/reset/verify`,
    api_sso_discover: `/api/auth/sso/discover`,
    api_sso_start: `/api/auth/sso/start`,
  },
  API: {
    desktop_downloads: `${process.env.NX_PUBLIC_SERVER_URL || 'https://getjetstream.app'}/desktop-assets/downloads`,
  },
};

export const SIGN_IN_ERRORS = {
  ...AUTH_ERROR_MESSAGES,
  default: 'Check your details and try again.',
};
