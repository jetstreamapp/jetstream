module.exports = {
  siteUrl: 'https://getjetstream.app',
  sourceDir: 'apps/landing/.next',
  outDir: 'dist/apps/landing',

  generateRobotsTxt: true, // (optional)
  // Keep in sync with NOINDEX_PATH_PREFIXES in apps/landing/components/layouts/LayoutHead.tsx
  exclude: [
    '/404*',
    '/auth/verify*',
    '/auth/mfa-enroll*',
    '/auth/accept-terms*',
    '/auth/password-reset*',
    '/auth/email-change*',
    '/canvas-auth*',
    '/desktop-app/auth*',
    '/desktop-app/google-picker*',
    '/goodbye*',
    '/oauth-*',
    '/web-extension*',
  ],
  robotsTxtOptions: {
    policies: [{ userAgent: '*', disallow: ['/cgi-bin/', '/tmp/'], allow: '/' }],
    additionalSitemaps: ['https://docs.getjetstream.app/sitemap.xml'],
  },
};
