module.exports = {
  /** @type {import('@docusaurus/preset-classic').Si} */
  sidebar: [
    {
      type: 'doc',
      id: 'getting-started',
      label: 'Getting Started',
    },
    {
      type: 'category',
      label: 'Core Features',
      items: ['query', 'load', 'automation-control', 'permissions', 'deploy', 'feedback'],
    },
    {
      type: 'category',
      label: 'Developer Tools',
      items: ['anonymous-apex', 'debug-logs', 'salesforce-api', 'platform-events'],
    },
  ],
};
