import type * as Preset from '@docusaurus/preset-classic';
import type { Config, } from '@docusaurus/types';

// const config: Config = {
//   title: 'My Site',
//   favicon: 'img/favicon.ico',
//   presets: [
//     [
//       'classic',
//       {
//         /* Your preset config here */
//       } satisfies Preset.Options,
//     ],
//   ],

//   themeConfig: {
//     /* Your theme config here */
//   } satisfies Preset.ThemeConfig,
// };


const config: Config = {
  title: 'Jetstream',
  tagline: 'Documentation',
  url: 'https://docs.getjetstream.app',
  baseUrl: '/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'throw',
  favicon: 'img/favicon-inverse.ico',
  organizationName: 'jetstream', // Usually your GitHub org/user name.
  projectName: 'jetstream', // Usually your repo name.
  trailingSlash: false,
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },
  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          sidebarPath: 'sidebars.ts',
          sidebarCollapsed: false,
          routeBasePath: '/',
          editUrl: 'https://github.com/jetstreamapp/jetstream/tree/main/apps/docs/',
        },
        gtag: {
          anonymizeIP: true,
          trackingID: 'G-GZJ9QQTK44',
        },
        theme: {
          customCss: ['./src/css/custom.css'],
        },
        sitemap: {
          changefreq: 'weekly' as any, // FIXME: figure out how to use enum
          priority: 0.5,
        },
      } satisfies Preset.Options,
    ],
  ],
  themeConfig:
    {
      algolia: {
        appId: '21D7I5RB7N',
        apiKey: '16cff3d92b030f175ef9a30f606a221e',
        indexName: 'jetstream-docs',
        // Optional: see doc section below
        contextualSearch: false,
        // Optional: Algolia search parameters
        searchParameters: {},
        //... other Algolia params
      },
      // Example announcement banner
      // https://docusaurus.io/docs/api/themes/configuration#announcement-bar
      // announcementBar: {
      //   id: 'support_us',
      //   content: 'We are looking to revamp our docs, please fill <a target="_blank" rel="noopener noreferrer" href="#">this survey</a>',
      //   backgroundColor: '#fafbfc',
      //   textColor: '#091E42',
      //   isCloseable: false,
      // },
      image:
        'https://res.cloudinary.com/getjetstream/image/upload/b_rgb:ffffff,bo_3px_solid_rgb:ffffff,pg_1/v1634516631/public/jetstream-logo-1200w.png',
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
                href: 'https://getjetstream.app/subprocessors/',
                label: 'Data Sub-Processors',
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
    } satisfies Preset.ThemeConfig,
};

export default config;
