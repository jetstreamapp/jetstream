module.exports = {
  siteUrl: 'https://getjetstream.app',
  sourceDir: 'apps/landing/.next',
  outDir: 'dist/apps/landing',

  generateRobotsTxt: true, // (optional)
  exclude: ['/goodbye*', '/oauth-*', '/web-extension*'],
  robotsTxtOptions: {
    policies: [{ userAgent: '*', disallow: ['/cgi-bin/', '/tmp/'], allow: '/' }],
    additionalSitemaps: ['https://docs.getjetstream.app/sitemap.xml'],
  },
};
