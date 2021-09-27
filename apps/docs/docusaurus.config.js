/** @type {import('@docusaurus/types').DocusaurusConfig} */
module.exports = {
  title: 'Jetstream',
  tagline: 'Documentation',
  url: 'https://docs.getjetstream.app',
  baseUrl: '/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  favicon: 'img/favicon-inverse.ico',
  organizationName: 'jetstream', // Usually your GitHub org/user name.
  projectName: 'jetstream', // Usually your repo name.
  trailingSlash: false,
  themeConfig: {
    algolia: {
      appId: '21D7I5RB7N',
      apiKey: '5a8e69d756ddc4a3067c7d9e7aecfc3b',
      indexName: 'jetstream-docs',
      // Optional: see doc section below
      contextualSearch: false,
      // Optional: Algolia search parameters
      searchParameters: {},
      //... other Algolia params
    },
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    navbar: {
      logo: {
        alt: 'Jetstream logo',
        src: 'img/jetstream-logo.svg',
        srcDark: 'img/jetstream-logo-inverse.svg',
      },
      items: [
        {
          href: 'https://getjetstream.app',
          label: 'Jetstream',
          position: 'right',
        },
      ],
    },
    /** @type {import('@docusaurus/theme-common').Footer} */
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Jetstream',
          items: [
            {
              href: 'https://getjetstream.app',
              label: 'Jetstream',
            },
            {
              href: 'mailto:support@getjetstream.app',
              label: 'Contact Us',
            },
          ],
        },
        {},
        {
          title: 'Legal',
          items: [
            {
              href: 'https://getjetstream.app/terms-of-service/',
              label: 'Terms of Service',
            },
            {
              href: 'https://getjetstream.app/privacy/',
              label: 'Privacy Policy',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Jetstream.`,
    },
  },
  presets: [
    [
      '@docusaurus/preset-classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          sidebarCollapsed: false,
          routeBasePath: '/',
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
        sitemap: {
          changefreq: 'weekly',
          priority: 0.5,
        },
      }),
    ],
  ],
};
