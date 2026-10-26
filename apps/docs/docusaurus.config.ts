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
          path: '../../architecture',
          exclude: ['infrastructure.md'],
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
        },
        blog: false,
        theme: {},
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    navbar: { title: 'AWS X-Ray example' },
    footer: { style: 'light' },
  } satisfies Preset.ThemeConfig,
};

export default config;
