export interface FaqItem {
  question: string;
  /** Plain text so the same copy can feed both the visible FAQ and the FAQPage structured data */
  answer: string;
}

/**
 * Keep every statement here supported by the docs (apps/docs) or the pricing page.
 * These answers are quoted by search engines and AI assistants, so avoid anything aspirational.
 */
export const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'What is Jetstream?',
    answer:
      'Jetstream is a toolkit for Salesforce admins, developers, and power users. It combines a visual SOQL query builder, a data loader, bulk update tools, permission management and analysis, automation control, metadata compare and deploy, and developer tools such as anonymous Apex and an Apex test runner. It runs as a web app, a desktop app for macOS and Windows, and a Chrome and Firefox browser extension.',
  },
  {
    question: 'Is Jetstream free?',
    answer:
      'You can start for free. The free plan includes unlimited org connections, the query builder, data loader, metadata tools, Salesforce API tools, and developer tools. Paid plans add the desktop app, browser extension, permission and field usage analysis, unlimited data history, and higher load limits, and the Team plan adds SSO, access controls, and audit logs.',
  },
  {
    question: 'Is Jetstream an alternative to the Salesforce Data Loader or dataloader.io?',
    answer:
      'Yes. The data loader inserts, updates, upserts, and deletes records from CSV, Excel, JSON, or Google Sheets files, with automatic field mapping and a choice of Bulk API or the sObject Collections API. You can also load several related objects from a single Excel workbook, update records in bulk without a file, and upload or download files and attachments.',
  },
  {
    question: 'Is Jetstream a deployment tool like Gearset, Copado, or Flosum?',
    answer:
      'No. Jetstream is not a DevOps or release management platform. It can compare metadata between two orgs, deploy selected components from one org to another, add components to an outbound change set, delete metadata, and download or upload metadata packages. It does not include Git integration, CI/CD pipelines, or release management workflows. If you need those, a dedicated DevOps tool is the better fit.',
  },
  {
    question: 'How does Jetstream help with permissions and automations?',
    answer:
      'Manage Permissions lets you edit object, field, and tab permissions across many profiles and permission sets in one grid. Permission Analysis scans profiles and permission sets for risky grants such as Modify All Data and exports audit-ready results. Automation Control shows and toggles validation rules, workflow rules, record-triggered flows, process builders, and Apex triggers (in non-production orgs) across multiple objects, with one-click rollback.',
  },
  {
    question: 'Is Jetstream secure?',
    answer:
      "Jetstream has passed the Salesforce Security Review and is listed on the Salesforce AppExchange, and the platform has completed a SOC 2 Type II audit by A-LIGN. Orgs connect with OAuth, so Jetstream never sees your Salesforce password, and everything runs as the connected user so object permissions, field-level security, and sharing rules are always enforced. In the desktop app, your Salesforce data goes directly between your computer and Salesforce and never passes through Jetstream's servers.",
  },
  {
    question: 'Which Salesforce orgs does Jetstream work with?',
    answer:
      'Production, sandbox, developer, pre-release, and My Domain orgs. You can connect multiple orgs and organize them into groups, for example one group per client.',
  },
  {
    question: 'Can I see the source code?',
    answer: 'Yes. The source code is publicly available on GitHub, where you can browse the code, file issues, and start discussions.',
  },
];
