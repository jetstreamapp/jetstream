import { ROUTES } from '../../utils/environment';
import { FaqItem } from '../landing/faq-data';

export interface IntentPageContent {
  /** Route without trailing slash, e.g. `/soql-query-builder` */
  route: string;
  /** Short name used for breadcrumbs and "related pages" links */
  name: string;
  /** `task` pages are linked from the homepage task row; `alternative` pages compare Jetstream with another tool */
  kind: 'task' | 'alternative';
  title: string;
  description: string;
  eyebrow: string;
  heading: string;
  lead: string;
  featuresHeading: string;
  features: Array<{ title: string; description: string }>;
  steps: Array<{ title: string; description: string }>;
  /** Plain-language limits and plan notes, kept honest so the page can be quoted accurately */
  goodToKnow: string[];
  /** Side-by-side comparison with other tools; every competitor cell must come from that tool's own docs or listing */
  comparison?: {
    heading: string;
    intro: string;
    columns: string[];
    rows: Array<{ feature: string; values: string[] }>;
    /** ISO date the competitor facts were last checked, shown on the page */
    lastReviewed: string;
    footnote?: string;
  };
  faq: FaqItem[];
  docLinks: Array<{ label: string; href: string }>;
}

/**
 * Keep every statement here supported by the docs (apps/docs) or the pricing page.
 * Marketing tone is fine, but nothing on these pages should promise behavior the product does not have.
 */
export const INTENT_PAGES: IntentPageContent[] = [
  {
    route: '/salesforce-data-loader-alternative',
    kind: 'task',
    name: 'Salesforce Data Loader alternative',
    title: 'Salesforce Data Loader Alternative | Jetstream',
    description:
      'A Salesforce data loader that runs in your browser: insert, update, upsert, and delete from CSV, Excel, or JSON with visual field mapping. Free to start.',
    eyebrow: 'Data loader',
    heading: 'A Salesforce Data Loader alternative that runs in your browser',
    lead: 'Insert, update, upsert, and delete Salesforce records from CSV, Excel, or JSON files with visual field mapping and per-record results. Nothing to install, and free to start.',
    featuresHeading: 'Data loader features',
    features: [
      {
        title: 'CSV, Excel, JSON, and Google Sheets',
        description: 'Load from CSV, Excel (.xlsx), or JSON files, and from Google Sheets on paid plans.',
      },
      {
        title: 'Visual field mapping',
        description:
          'Columns are matched automatically by API name or label. Map a lookup to a value on the related record, like an owner name, instead of looking up Ids first, and save mappings for repeat loads.',
      },
      {
        title: 'Insert, update, upsert, and delete',
        description: 'Insert, update, upsert on any External Id, delete, and hard delete when you have the permission.',
      },
      {
        title: 'Your choice of API',
        description:
          'Use the Bulk API for large volumes or the sObject Collections API for faster small and medium loads, with batch size, serial mode, and a clear-blank-fields option.',
      },
      {
        title: 'Parent and child in one load',
        description:
          'Load related objects from a single Excel workbook using reference Ids. Jetstream orders the loads and fills in the real Ids for you.',
      },
      {
        title: 'Per-record results',
        description:
          'See success and failure for every record, retry only the failed rows, and download results files. Data History keeps a record of past loads on your device.',
      },
      {
        title: 'Files and attachments',
        description:
          'Upload files, attachments, and ContentVersion records from a zip, and load custom metadata type records from a spreadsheet.',
      },
      {
        title: 'Update without a file',
        description: 'Set a field value across one or many objects without preparing a file.',
      },
    ],
    steps: [
      { title: 'Connect your org', description: 'Sign in with Salesforce using OAuth. Jetstream never sees your Salesforce password.' },
      { title: 'Pick an object and operation', description: 'Choose insert, update, upsert, or delete, then drop in your file.' },
      { title: 'Map your fields', description: 'Review the automatic mappings, adjust any that need it, and choose your API options.' },
      {
        title: 'Load and review',
        description: 'Watch progress, then review results per record, retry failures, and download the results.',
      },
    ],
    goodToKnow: [
      'The free plan includes the data loader, with up to 1,000 API calls per load. Paid plans raise that to 5,000, and the desktop app and browser extension have no Jetstream-imposed limit.',
      'Multi-object loads work in groups of up to 500 records, and each group succeeds or fails together.',
      'Jetstream always acts as the connected user, so object permissions, field-level security, and sharing rules are enforced.',
    ],
    comparison: {
      heading: 'Jetstream vs Salesforce Data Loader vs dataloader.io',
      intro:
        'All three load data into Salesforce. They differ in where they run, which files they accept, and what else they do. Here is how they compare.',
      columns: ['Jetstream', 'Salesforce Data Loader', 'Dataloader from MuleSoft (dataloader.io)'],
      rows: [
        {
          feature: 'Where it runs',
          values: [
            'Web app, desktop app for macOS and Windows, Chrome and Firefox extension',
            'Desktop app for Windows and macOS, requires Java 17 or later',
            'Web app',
          ],
        },
        {
          feature: 'Price',
          values: [
            'Free plan, paid plans from $25 per month',
            'Included with Enterprise, Unlimited, Performance, and Developer editions',
            'Free plan up to 10,000 records per month, paid plans from $99 per user per month',
          ],
        },
        { feature: 'File formats', values: ['CSV, Excel, JSON, and Google Sheets on paid plans', 'CSV', 'CSV'] },
        {
          feature: 'Operations',
          values: [
            'Insert, update, upsert, delete, hard delete, export from the query builder',
            'Insert, update, upsert, delete, hard delete, export',
            'Insert, update, upsert, delete, hard delete, export',
          ],
        },
        {
          feature: 'APIs',
          values: ['Bulk API or sObject Collections API', 'SOAP API, Bulk API, or Bulk API 2.0', 'Bulk API or Batch API'],
        },
        {
          feature: 'Lookups without Ids',
          values: [
            'Map a lookup to any value on the related record',
            'Match related records by External Id',
            'Look up parents by a value such as account name',
          ],
        },
        {
          feature: 'Parent and child records in one load',
          values: ['Yes, from one Excel workbook', 'One object per run', 'One object per task'],
        },
        {
          feature: 'Bulk update without a file',
          values: ['Yes, by criteria across one or many objects', 'No, a file is required', 'No, a file is required'],
        },
        {
          feature: 'Scheduled or command-line loads',
          values: ['No', 'Command-line batch mode on Windows', 'Scheduled tasks on every plan'],
        },
        {
          feature: 'Largest loads',
          values: [
            'Bulk API, with up to 1,000 API calls per load on the free plan and 5,000 on paid plans',
            'Up to 150 million records with Bulk API 2.0',
            '10,000 records per month on the free plan, unlimited on Enterprise',
          ],
        },
        {
          feature: 'Beyond data loading',
          values: [
            'Query builder, permissions, automation control, metadata compare and deploy, developer tools',
            'Data only',
            'Data only',
          ],
        },
      ],
      lastReviewed: '2026-11-02',
      footnote: 'For very large loads or loads that run on a schedule, Salesforce Data Loader or dataloader.io may be the better fit.',
    },
    faq: [
      {
        question: 'Is Jetstream a free alternative to the Salesforce Data Loader?',
        answer:
          'You can start for free. The free plan includes the data loader, unlimited org connections, the query builder, and more. Paid plans raise the API calls allowed per load and add the desktop app, browser extension, and unlimited data history.',
      },
      {
        question: 'Does Jetstream use the Bulk API?',
        answer:
          'Yes. For each load you can choose the Bulk API, which suits high volumes, or the sObject Collections API (called the Batch API in Jetstream), which is faster for small and medium loads.',
      },
      {
        question: 'Can I load parent and child records at the same time?',
        answer:
          'Yes. Put each object on its own worksheet in one Excel workbook and link the rows with reference Ids. Jetstream works out the load order and fills in the real Salesforce Ids as parents are created.',
      },
      {
        question: 'Is my data safe?',
        answer:
          'Jetstream has passed the Salesforce Security Review and is listed on the AppExchange, and the platform has completed a SOC 2 Type II audit. In the desktop app, your Salesforce data goes directly between your computer and Salesforce and never passes through Jetstream servers.',
      },
    ],
    docLinks: [
      { label: 'Load records', href: `${ROUTES.EXTERNAL.DOCS}/load` },
      { label: 'Load related objects', href: `${ROUTES.EXTERNAL.DOCS}/load/with-related` },
      { label: 'Update records without a file', href: `${ROUTES.EXTERNAL.DOCS}/load/update-records` },
    ],
  },
  {
    route: '/soql-query-builder',
    kind: 'task',
    name: 'SOQL query builder',
    title: 'Salesforce SOQL Query Builder | Jetstream',
    description:
      'Build SOQL visually with nested filters, subqueries, and aggregates, then edit records inline and export to Excel, CSV, or JSON. A free Salesforce query builder.',
    eyebrow: 'Query builder',
    heading: 'A visual SOQL query builder for Salesforce',
    lead: 'Pick an object, click the fields you want, and add filters without remembering a single API name. Run the query, edit the results inline, and export to Excel, CSV, or JSON.',
    featuresHeading: 'Query builder features',
    features: [
      {
        title: 'Fields across relationships',
        description:
          'Browse and select fields from related objects, up to six relationship levels deep, and filter the field list by creatable, updateable, or custom.',
      },
      {
        title: 'Filter groups and operators',
        description:
          'Group conditions with AND and OR, use contains, starts with, IN lists, relative dates, and Includes and Excludes for multi-select picklists.',
      },
      {
        title: 'Subqueries and aggregates',
        description:
          'Add child relationships as subqueries, nested up to four levels, and use GROUP BY, HAVING, COUNT, and field functions like FORMAT.',
      },
      {
        title: 'Autocomplete in the manual editor',
        description:
          'The manual SOQL editor suggests objects, fields, relationships, and picklist values pulled live from the org you have selected.',
      },
      {
        title: 'Paste existing SOQL',
        description: 'Paste an existing SOQL query and restore it into the builder, or just execute it as written.',
      },
      {
        title: 'Edit results in place',
        description:
          'Edit, clone, delete, or undelete records straight from the results, or bulk update the selection with a preview of the original and new values.',
      },
      {
        title: 'Export what you need',
        description:
          'Download to Excel, CSV, or JSON, or save to Google Drive on paid plans. Use the Excel load template to move records between orgs.',
      },
      {
        title: 'Metadata and files too',
        description:
          'Query Tooling API objects like validation rules with the same builder, and bulk download files and attachments from your results.',
      },
    ],
    steps: [
      { title: 'Choose an object', description: 'Search or pick from every queryable object in the org.' },
      {
        title: 'Select fields',
        description: 'Click fields, including those on related objects, and add child subqueries if you need them.',
      },
      {
        title: 'Add filters and options',
        description: 'Build filter groups, set order, limit, and aggregates, and see the SOQL update as you go.',
      },
      {
        title: 'Run it and act on the results',
        description: 'Search and filter the results, edit records inline, export, or save the query to your history.',
      },
    ],
    goodToKnow: [
      'The query builder is included in the free plan. Syncing query history across devices is a paid feature.',
      'Jetstream runs queries as the connected user, so you only see records and fields that user can access.',
      'Querying the FullName or Metadata field on metadata objects returns one record at a time, which is a Salesforce restriction.',
    ],
    faq: [
      {
        question: 'Is the Jetstream query builder free?',
        answer: 'Yes. The query builder is part of the free plan, along with the data loader, metadata tools, and developer tools.',
      },
      {
        question: 'Can I still write SOQL by hand?',
        answer:
          'Yes. The manual editor offers autocomplete based on the org you have selected, and you can paste a query and restore it into the visual builder at any time.',
      },
      {
        question: 'Can I edit records from query results?',
        answer:
          'Yes. You can edit a record, clone it, delete or undelete selected records, or bulk update the selection with a preview of the changes before anything is saved.',
      },
      {
        question: 'Can I query metadata like validation rules?',
        answer:
          'Yes. The same builder works with Tooling API objects, so you can query things like validation rules, and there is an explorer for object and field API names, picklist values, and field dependencies.',
      },
    ],
    docLinks: [
      { label: 'Query builder', href: `${ROUTES.EXTERNAL.DOCS}/query` },
      { label: 'Query results', href: `${ROUTES.EXTERNAL.DOCS}/query/results` },
    ],
  },
  {
    route: '/compare-salesforce-permissions',
    kind: 'task',
    name: 'Compare Salesforce permissions',
    title: 'Compare Salesforce Profile & Permission Set Access | Jetstream',
    description:
      'Compare and edit object, field, and tab permissions across many Salesforce profiles and permission sets in one grid, and audit risky access like Modify All Data.',
    eyebrow: 'Permissions',
    heading: 'Compare and audit Salesforce profile and permission set access',
    lead: 'See object, field, and tab permissions across many profiles and permission sets side by side, change them in bulk, and scan for risky access.',
    featuresHeading: 'Permission tools',
    features: [
      {
        title: 'Side-by-side comparison',
        description:
          'Pick the profiles and permission sets you care about and compare their object, field, and tab permissions in a single grid.',
      },
      {
        title: 'Bulk edit',
        description: 'Toggle a cell, a row, or a column, and dependent permissions are adjusted for you.',
      },
      {
        title: 'System permissions',
        description: 'Manage system permissions with their dependencies handled, alongside object and field access.',
      },
      {
        title: 'Permission set assignments',
        description: 'Add or remove users on a permission set, and create a new one or clone it from a profile or another permission set.',
      },
      {
        title: 'Permission Analysis',
        description:
          'Scan selected profiles and permission sets for findings like Modify All Records, high-risk system permissions, field access without object access, and unassigned permission sets. Available on paid plans.',
      },
      {
        title: 'Exports for audits',
        description: 'Download any grid to Excel, CSV, or JSON for access reviews and audits, or save it to Google Drive on paid plans.',
      },
    ],
    steps: [
      { title: 'Select what to compare', description: 'Choose profiles and permission sets, and optionally narrow to specific objects.' },
      { title: 'Review the grid', description: 'Spot differences across object, field, and tab permissions at a glance.' },
      {
        title: 'Edit or analyze',
        description: 'Make bulk changes and save, or run Permission Analysis for a read-only audit of risky access.',
      },
      { title: 'Export the results', description: 'Download the grids for documentation, reviews, or sign-off.' },
    ],
    goodToKnow: [
      'Managing permissions is available without a paid plan. Permission Analysis is a paid feature and is read-only.',
      'Saving permission changes requires the Manage Profiles and Permission Sets permission in Salesforce.',
      'Permission Analysis evaluates each profile and permission set on its own, so some findings can be intentional when users also hold other permission sets.',
    ],
    faq: [
      {
        question: 'Can I compare two Salesforce profiles or permission sets side by side?',
        answer:
          'Yes. Select the profiles and permission sets you want and each one becomes a column in the grid, so you can compare object, field, and tab permissions directly and edit them in bulk.',
      },
      {
        question: 'Can Jetstream find profiles and permission sets that grant Modify All Data?',
        answer:
          'Permission Analysis, a paid feature, flags broad grants such as Modify All Data and View All Data, along with other high-risk system permissions, and lets you export the findings.',
      },
      {
        question: 'Does running an analysis change anything in my org?',
        answer: 'No. Permission Analysis only reads your configuration. Nothing changes until you edit and save permissions yourself.',
      },
      {
        question: 'Can I export permissions for an audit?',
        answer: 'Yes. Every permission grid can be downloaded to Excel, CSV, or JSON, and paid plans can also save to Google Drive.',
      },
    ],
    docLinks: [
      { label: 'Manage permissions', href: `${ROUTES.EXTERNAL.DOCS}/permissions` },
      { label: 'Permission analysis', href: ROUTES.EXTERNAL.DOCS_PERMISSION_ANALYSIS },
    ],
  },
  {
    route: '/bulk-update-salesforce-records',
    kind: 'task',
    name: 'Bulk update Salesforce records',
    title: 'Bulk Update Salesforce Records Without a File | Jetstream',
    description:
      'Update Salesforce records in bulk without exporting a CSV: set a field to a value, copy another field, or clear it across one or many objects. Free to start.',
    eyebrow: 'Mass update',
    heading: 'Bulk update Salesforce records without a spreadsheet',
    lead: 'Choose the objects, pick the field and the new value, and Jetstream updates every matching record without exporting anything to a spreadsheet first.',
    featuresHeading: 'Mass update features',
    features: [
      {
        title: 'Set, copy, or clear',
        description: 'Set a field to a value you provide, copy the value from another field, or clear it out.',
      },
      {
        title: 'Choose which records change',
        description:
          'Update all records, only the blank ones, only the non-blank ones, or any set you can describe with a SOQL WHERE clause.',
      },
      {
        title: 'Many objects at once',
        description: 'Apply updates across several objects in one pass, handy for populating External Id fields before a migration.',
      },
      {
        title: 'Validate before you run',
        description: 'Validate first to see exactly how many records will change, and optionally cap the number of records updated.',
      },
      {
        title: 'Re-trigger automation',
        description: 'Run an update without changing any values to fire a newly activated flow or other automation on existing records.',
      },
      {
        title: 'Update from query results',
        description: 'Select records in your query results, bulk update them, and compare original and new values before saving.',
      },
    ],
    steps: [
      { title: 'Choose objects', description: 'Select one or many objects to update.' },
      { title: 'Define the change', description: 'Pick the field, then choose a value, a copy of another field, or clear it.' },
      {
        title: 'Set criteria and validate',
        description: 'Limit the update with a filter and confirm the exact number of records affected.',
      },
      {
        title: 'Run it and review',
        description: 'Watch progress and review results, which are also saved to Data History on your device.',
      },
    ],
    goodToKnow: [
      'Mass updates are included in the free plan and use the Bulk API, with serial mode available for orgs that need it.',
      'Updates run as the connected user, so object permissions, field-level security, and validation rules still apply.',
      'Updates run against the live org, so try them in a sandbox first and use the validate step to confirm the record count.',
    ],
    faq: [
      {
        question: 'How do I mass update records in Salesforce without a CSV file?',
        answer:
          'Use Update Records in Jetstream. Choose the object, the field, and the new value, optionally add criteria, validate the record count, and run it. No spreadsheet is involved.',
      },
      {
        question: 'Can I update only records where a field is blank?',
        answer:
          'Yes. You can update all records, only records where the field is blank, only where it is not blank, or use a custom SOQL WHERE clause.',
      },
      {
        question: 'Can I re-run a flow on existing records?',
        answer:
          'Yes. Choose to update without changing values and Jetstream saves the records as they are, which fires automation such as a newly activated flow.',
      },
      {
        question: 'Is the bulk update tool free?',
        answer: 'Yes, it is part of the free plan along with the query builder and data loader.',
      },
    ],
    docLinks: [
      { label: 'Update records without a file', href: `${ROUTES.EXTERNAL.DOCS}/load/update-records` },
      { label: 'Automation control', href: `${ROUTES.EXTERNAL.DOCS}/automation-control` },
    ],
  },
  {
    route: '/salesforce-workbench-alternative',
    kind: 'alternative',
    name: 'Salesforce Workbench alternative',
    title: 'Salesforce Workbench Alternative | Jetstream',
    description:
      'Salesforce no longer maintains Workbench. Jetstream covers the same work: SOQL queries, data loads, REST API calls, anonymous Apex, and metadata deploys.',
    eyebrow: 'Workbench alternative',
    heading: 'A Salesforce Workbench alternative that is still being built',
    lead: 'Salesforce says it does not maintain Workbench and cannot fix issues with it. Jetstream covers the same everyday work, from SOQL queries and data loads to REST calls, anonymous Apex, and metadata deploys, with new releases most weeks.',
    featuresHeading: 'Everything you used Workbench for',
    features: [
      {
        title: 'SOQL queries',
        description:
          'Build queries visually or write SOQL with autocomplete from your org, then edit, delete, or undelete records right in the results.',
      },
      {
        title: 'Data loads',
        description:
          'Insert, update, upsert, and delete from CSV, Excel, or JSON files with automatic field mapping, using the Bulk API or the sObject Collections API.',
      },
      {
        title: 'REST and SOAP API calls',
        description: 'Send any Salesforce API request, start from common endpoint templates, and replay requests from your history.',
      },
      {
        title: 'Anonymous Apex',
        description: 'Run Apex in a full code editor with autocomplete, set log levels, and search the debug log output.',
      },
      {
        title: 'Metadata retrieve and deploy',
        description:
          'Download metadata by type or from a package.xml, deploy a zip, or compare two orgs line by line and deploy the differences.',
      },
      {
        title: 'Object and field details',
        description: 'Look up API names, picklist values, and field dependencies, and export object and field metadata to a spreadsheet.',
      },
    ],
    comparison: {
      heading: 'Jetstream vs Salesforce Workbench',
      intro:
        'Workbench still runs, but Salesforce recommends moving off it. Here is how the two compare for the tasks people use Workbench for.',
      columns: ['Jetstream', 'Workbench'],
      rows: [
        {
          feature: 'Maintenance',
          values: [
            'Actively developed, with new releases most weeks',
            'Maintenance only. Salesforce says it does not maintain Workbench and recommends other tools.',
          ],
        },
        { feature: 'Support', values: ['Email support, plus priority support on paid plans', 'Not supported by Salesforce'] },
        { feature: 'Price', values: ['Free plan, paid plans from $25 per month', 'Free'] },
        { feature: 'SOQL queries', values: ['Visual builder, plus manual SOQL with autocomplete', 'Form-based builder, plus manual SOQL'] },
        { feature: 'Edit records from query results', values: ['Yes', 'No, records are edited from the Data menu'] },
        { feature: 'Data load file formats', values: ['CSV, Excel, and JSON', 'CSV'] },
        { feature: 'Bulk API', values: ['Yes', 'Yes'] },
        { feature: 'REST explorer', values: ['Yes, with request history and templates', 'Yes'] },
        { feature: 'Anonymous Apex', values: ['Yes, with autocomplete', 'Yes'] },
        { feature: 'Metadata retrieve and deploy', values: ['Yes', 'Yes'] },
        { feature: 'Compare metadata between orgs', values: ['Yes', 'No'] },
        { feature: 'Permissions and automation tools', values: ['Compare and edit permissions, toggle automations', 'No'] },
      ],
      lastReviewed: '2026-11-02',
      footnote:
        'For source-driven development, Salesforce recommends the Salesforce CLI and VS Code extensions, which work alongside Jetstream.',
    },
    steps: [
      {
        title: 'Sign up for free',
        description: 'Create a Jetstream account. The free plan covers queries, data loads, metadata tools, and developer tools.',
      },
      { title: 'Connect your org', description: 'Authorize with Salesforce using OAuth, the same way you would for any connected app.' },
      {
        title: 'Pick up where Workbench left off',
        description: 'Open the query builder, data loader, API explorer, or anonymous Apex from the home page.',
      },
    ],
    goodToKnow: [
      'Jetstream is not a replacement for the Salesforce CLI or source control. It covers the interactive, point-and-click work.',
      'Jetstream always acts as the connected user, so object permissions, field-level security, and sharing rules are enforced.',
      'Your Salesforce org admin may need to install the Jetstream connected app before you can connect.',
    ],
    faq: [
      {
        question: 'Is Salesforce Workbench being retired?',
        answer:
          'Salesforce has not announced a retirement date, but its Spring ’24 release notes say Salesforce does not maintain Workbench, cannot fix issues with it, and cannot promise it will stay available. It recommends moving to other tools.',
      },
      {
        question: 'What can I use instead of Workbench?',
        answer:
          'For queries, data loads, API calls, anonymous Apex, and metadata deploys, Jetstream covers the same tasks in one app. For source-driven development, Salesforce recommends the Salesforce CLI and VS Code extensions.',
      },
      {
        question: 'Is Jetstream free like Workbench?',
        answer:
          'Jetstream has a free plan that includes the query builder, data loader, metadata tools, and developer tools. Paid plans add the desktop app, browser extension, and more.',
      },
      {
        question: 'Can Jetstream run anonymous Apex and REST requests?',
        answer:
          'Yes. Jetstream has an anonymous Apex editor with autocomplete and log search, and an API explorer for sending REST and SOAP requests with saved history.',
      },
    ],
    docLinks: [
      { label: 'Salesforce API explorer', href: `${ROUTES.EXTERNAL.DOCS}/developer/salesforce-api` },
      { label: 'Anonymous Apex', href: `${ROUTES.EXTERNAL.DOCS}/developer/anonymous-apex` },
      { label: 'Deploy or compare metadata', href: `${ROUTES.EXTERNAL.DOCS}/deploy-metadata` },
    ],
  },
  {
    route: '/salesforce-inspector-alternative',
    kind: 'alternative',
    name: 'Salesforce Inspector alternative',
    title: 'Salesforce Inspector Alternative | Jetstream',
    description:
      'Jetstream gives you record inspection on any Salesforce page, plus Bulk API data loads, a visual SOQL builder, and permission and automation tools.',
    eyebrow: 'Inspector alternative',
    heading: 'A Salesforce Inspector alternative with a full toolkit behind it',
    lead: 'The original Salesforce Inspector has not been updated since 2022 and no longer runs in current versions of Chrome. Jetstream gives you quick record access on any Salesforce page, backed by Bulk API data loads, a visual query builder, and permission and automation tools.',
    featuresHeading: 'What you get with Jetstream',
    features: [
      {
        title: 'On every Salesforce page',
        description:
          'The browser extension adds a Jetstream button to Salesforce, with quick access to query, load, automation, and permission tools.',
      },
      {
        title: 'View and edit any record',
        description: 'Open the record you are on or paste any record Id to view and edit its fields.',
      },
      {
        title: 'Find users fast',
        description: 'Search users by name, email, or username, open them in Salesforce, and log in as them when you have permission.',
      },
      {
        title: 'Loads that scale',
        description:
          'Load CSV, Excel, or JSON files with the Bulk API, map fields automatically, and load parent and child records together.',
      },
      {
        title: 'A visual query builder',
        description: 'Click through objects, fields, and filters instead of typing SOQL, or write it by hand with autocomplete.',
      },
      {
        title: 'Permissions and automation',
        description: 'Compare and edit permissions across profiles and permission sets, and turn automations off and on with rollback.',
      },
    ],
    comparison: {
      heading: 'Jetstream vs Salesforce Inspector Reloaded',
      intro:
        'Salesforce Inspector Reloaded is the community-maintained successor to the original Inspector. Here is how it compares with Jetstream.',
      columns: ['Jetstream', 'Salesforce Inspector Reloaded'],
      rows: [
        { feature: 'Price', values: ['Web app free, browser extension on paid plans from $25 per month', 'Free and open source'] },
        { feature: 'Where it runs', values: ['Web app, desktop app, Chrome and Firefox extension', 'Chrome, Firefox, and Edge extension'] },
        { feature: 'View and edit a record', values: ['Yes', 'Yes, including fields not on the layout'] },
        { feature: 'Log in as a user', values: ['Yes, when you have permission', 'Yes'] },
        {
          feature: 'SOQL queries',
          values: ['Visual builder, plus manual SOQL with autocomplete', 'Manual SOQL and SOSL with autocomplete'],
        },
        {
          feature: 'Data loads',
          values: [
            'CSV, Excel, and JSON files with the Bulk API or sObject Collections API',
            'Pasted CSV or Excel data, without Bulk API support',
          ],
        },
        { feature: 'Metadata', values: ['Compare and deploy between orgs, change sets, package.xml', 'Retrieve and deploy zip packages'] },
        {
          feature: 'Compare profiles and permission sets',
          values: ['Yes, in one editable grid', 'Links to profiles and permission sets in Setup'],
        },
        {
          feature: 'Automation control',
          values: ['Toggle validation rules, workflow rules, flows, process builders, and triggers with rollback', 'Mass disable flows'],
        },
        {
          feature: 'Where your data goes',
          values: ['Straight from your browser to Salesforce in the extension and desktop app', 'Straight from your browser to Salesforce'],
        },
      ],
      lastReviewed: '2026-11-02',
      footnote: 'If a free extension for quick record inspection is all you need, Salesforce Inspector Reloaded is a solid choice.',
    },
    steps: [
      {
        title: 'Start with the free web app',
        description: 'Sign up and connect your org to use the query builder, data loader, and more at no cost.',
      },
      {
        title: 'Add the extension',
        description: 'Install Jetstream for Chrome or Firefox on a paid plan to work from any Salesforce page.',
      },
      {
        title: 'Work where you already are',
        description: 'Use the Jetstream button on Salesforce pages to open records, search users, and jump into any tool.',
      },
    ],
    goodToKnow: [
      'The browser extension requires a Professional plan or higher. The web app is free to start.',
      'The extension uses your existing Salesforce session, so you do not need to connect the org in Jetstream first.',
      'Platform Events and features that need two orgs, such as comparing metadata between orgs, are not available in the extension yet. Use the web or desktop app for those.',
    ],
    faq: [
      {
        question: 'Does the original Salesforce Inspector still work?',
        answer:
          'The original Salesforce Inspector has not been updated since 2022 and is a Manifest V2 extension, which current versions of Chrome no longer run. Salesforce Inspector Reloaded is its community-maintained successor.',
      },
      {
        question: 'Is Jetstream free?',
        answer: 'The Jetstream web app has a free plan. The browser extension is included with the Professional plan and higher.',
      },
      {
        question: 'Can Jetstream load large amounts of data?',
        answer:
          'Yes. Jetstream loads data with the Bulk API or the sObject Collections API, from CSV, Excel, or JSON files, and can load parent and child records together from one Excel workbook.',
      },
      {
        question: 'Does my data pass through Jetstream servers?',
        answer:
          'Not in the browser extension or desktop app. Both talk to Salesforce directly from your computer, so your Salesforce data never passes through Jetstream servers.',
      },
    ],
    docLinks: [
      { label: 'Browser extension', href: `${ROUTES.EXTERNAL.DOCS}/browser-extension` },
      { label: 'Load records', href: `${ROUTES.EXTERNAL.DOCS}/load` },
    ],
  },
];

export function getIntentPage(route: string): IntentPageContent {
  const page = INTENT_PAGES.find((intentPage) => intentPage.route === route);
  if (!page) {
    throw new Error(`No intent page defined for route ${route}`);
  }
  return page;
}
