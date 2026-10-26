import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'AWS X-Ray example',
  tagline: 'Architecture decisions and working journal',
  url: 'https://juan19932carlos.github.io',
  baseUrl: '/aws-xray-example/',
  organizationName: 'juan19932carlos',
  projectName: 'aws-xray-example',
  trailingSlash: false,
  onBrokenLinks: 'throw',

  markdown: {
    format: 'detect',
    mermaid: true,
  },
  themes: ['@docusaurus/theme-mermaid'],

  presets: [
    [
      'classic',
      {
        docs: {
          path: '../decisions',
          routeBasePath: 'decisions',
        },
        blog: false,
        theme: {},
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'journal',
        path: '../journal',
        routeBasePath: 'journal',
      },
    ],
  ],

  themeConfig: {
    navbar: {
      title: 'AWS X-Ray example',
      items: [
        { to: '/decisions/tech-stack', label: 'Decisions', position: 'right', activeBaseRegex: '/decisions' },
        { to: '/journal/first-configuration', label: 'Journal', position: 'right', activeBaseRegex: '/journal' },
      ],
    },
    footer: { style: 'light' },
  } satisfies Preset.ThemeConfig,
};

export default config;
