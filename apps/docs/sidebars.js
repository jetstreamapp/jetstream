// module.exports = {
//   /** @type {import('@docusaurus/preset-classic').Si} */
//   sidebar: [
//     {
//       type: 'doc',
//       id: 'getting-started',
//       label: 'Getting Started',
//     },
//     {
//       type: 'category',
//       label: 'Core Features',
//       items: [
//         {
//           type: 'category',
//           label: 'Query',
//           items: ['query/query', 'query/query-results'],
//         },
//         {
//           type: 'category',
//           label: 'Load',
//           items: ['load', 'load-with-related'],
//         },
//         'automation-control',
//         'permissions',
//         {
//           type: 'category',
//           label: 'Deployment Tools',
//           items: [
//             'deploy/deploy',
//             'deploy/deploy-org-to-org',
//             'deploy/deploy-add-to-changeset',
//             'deploy/deploy-compare',
//             'deploy/download-upload',
//           ],
//         },
//         'feedback',
//       ],
//     },
//     {
//       type: 'category',
//       label: 'Developer Tools',
//       items: ['anonymous-apex', 'debug-logs', 'salesforce-api', 'platform-events'],
//     },
//   ],
// };

module.exports = {
  /** @type {import('@docusaurus/preset-classic').Si} */
  sidebar: [
    'getting-started/getting-started',
    'feedback/feedback',
    {
      type: 'category',
      label: 'Query',
      items: ['query/query', 'query/query-results'],
    },
    {
      type: 'category',
      label: 'Load',
      items: ['load/load', 'load/load-with-related'],
    },
    'automation-control/automation-control',
    'permissions/permissions',
    {
      type: 'category',
      label: 'Deploy Metadata',
      items: ['deploy/deploy-metadata', 'deploy/deploy-fields'],
    },
    {
      type: 'category',
      label: 'Developer Tools',
      items: ['developer/anonymous-apex', 'developer/debug-logs', 'developer/salesforce-api', 'developer/platform-events'],
    },
  ],
};
