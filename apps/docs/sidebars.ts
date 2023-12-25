const sidebar = {
  sidebar: [
    {
      type: 'category',
      label: 'Getting Started',
      items: ['getting-started/overview', 'getting-started/feedback'],
    },
    {
      type: 'category',
      label: 'Query',
      items: ['query/query', 'query/query-results', 'query/download-attachments'],
    },
    {
      type: 'category',
      label: 'Load',
      items: ['load/load', 'load/load-custom-metadata', 'load/load-attachments', 'load/load-with-related', 'load/update-records'],
    },
    'automation-control/automation-control',
    'permissions/permissions',
    {
      type: 'category',
      label: 'Deploy Metadata',
      items: ['deploy/deploy-metadata', 'deploy/deploy-object', 'deploy/deploy-fields', 'deploy/formula-evaluator'],
    },
    {
      type: 'category',
      label: 'Developer Tools',
      items: [
        'developer/anonymous-apex',
        'developer/debug-logs',
        'developer/export-object-metadata',
        'developer/salesforce-api',
        'developer/platform-events',
      ],
    },
    'other/other-useful-features',
  ],
};

export default sidebar;
