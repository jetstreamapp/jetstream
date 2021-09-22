/** @type {import('@docusaurus/types').DocusaurusConfig} */
module.exports = {
  title: 'Jetstream',
  tagline: 'Documentation',
  url: 'https://docs.getjetstream.app',
  baseUrl: '/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  favicon: 'img/favicon.ico',
  organizationName: 'jetstream', // Usually your GitHub org/user name.
  projectName: 'jetstream', // Usually your repo name.
  themeConfig: {
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    navbar: {
      logo: {
        alt: 'Jetstream logo',
        src: 'img/jetstream-icon.png',
        srcDark: 'img/jetstream-icon-white-bg.png',
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
      links: [],
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
      }),
    ],
  ],
};
