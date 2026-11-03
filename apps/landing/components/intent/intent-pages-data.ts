import { ROUTES } from '../../utils/environment';
import { FaqItem } from '../landing/faq-data';

export interface IntentPageContent {
  /** Route without trailing slash, e.g. `/soql-query-builder` */
  route: string;
  /** Short name used for breadcrumbs and "related pages" links */
  name: string;
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
    name: 'Salesforce Data Loader alternative',
    title: 'Salesforce Data Loader Alternative | Jetstream',
    description:
      'Jetstream is a Salesforce data loader that runs in your browser: insert, update, upsert, and delete from CSV, Excel, or JSON with visual field mapping. Free to start.',
    eyebrow: 'Data loader',
    heading: 'A Salesforce Data Loader alternative that runs in your browser',
    lead: 'Insert, update, upsert, and delete Salesforce records from CSV, Excel, or JSON files with visual field mapping and per-record results. Nothing to install, and free to start.',
    featuresHeading: 'More than a file uploader',
    features: [
      {
        title: 'The files you already have',
        description: 'Load from CSV, Excel (.xlsx), or JSON files, and from Google Sheets on paid plans.',
      },
      {
        title: 'Visual field mapping',
        description:
          'Columns are matched automatically by API name or label. Map a lookup to a value on the related record, like an owner name, instead of looking up Ids first, and save mappings for repeat loads.',
      },
      {
        title: 'Every operation',
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
        title: 'Know exactly what happened',
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
        description: 'Skip the spreadsheet entirely and update records in bulk by setting a field value across one or many objects.',
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
    name: 'SOQL query builder',
    title: 'Salesforce SOQL Query Builder | Jetstream',
    description:
      'Build SOQL visually with nested filters, subqueries, and aggregates, then edit records inline and export to Excel, CSV, or JSON. A free Salesforce query builder.',
    eyebrow: 'Query builder',
    heading: 'A visual SOQL query builder for Salesforce',
    lead: 'Pick an object, click the fields you want, and add filters without remembering a single API name. Run the query, edit the results inline, and export to Excel, CSV, or JSON.',
    featuresHeading: 'Everything SOQL, without the typing',
    features: [
      {
        title: 'Fields across relationships',
        description:
          'Browse and select fields from related objects, up to six relationship levels deep, and filter the field list by creatable, updateable, or custom.',
      },
      {
        title: 'Filters that go beyond the basics',
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
          'Prefer typing? The SOQL editor suggests objects, fields, relationships, and picklist values pulled live from the org you have selected.',
      },
      {
        title: 'Paste a query, get the builder',
        description: 'Paste an existing SOQL query and restore it into the builder, or just execute it as written.',
      },
      {
        title: 'Edit results in place',
        description:
          'Edit, clone, delete, or undelete records straight from the results, or bulk update the selection with a preview of the original and new values.',
      },
      {
        title: 'Export what you need',
        description: 'Download to Excel, CSV, or JSON, or save to Google Drive. Use the Excel load template to move records between orgs.',
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
    name: 'Compare Salesforce permissions',
    title: 'Compare Salesforce Profile & Permission Set Access | Jetstream',
    description:
      'Compare and edit object, field, and tab permissions across many Salesforce profiles and permission sets in one grid, and audit risky access like Modify All Data.',
    eyebrow: 'Permissions',
    heading: 'Compare and audit Salesforce profile and permission set access',
    lead: 'See object, field, and tab permissions across many profiles and permission sets side by side, change them in bulk, and scan for risky access. No more opening setup pages one at a time.',
    featuresHeading: 'Permission work, in one grid',
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
        title: 'Audit-ready exports',
        description: 'Download any grid to Excel, CSV, JSON, or Google Drive, so an access review comes with its own evidence file.',
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
        question: 'Can Jetstream find users or profiles with Modify All Data?',
        answer:
          'Permission Analysis, a paid feature, flags broad grants such as Modify All Data and View All Data, along with other high-risk system permissions, and lets you export the findings.',
      },
      {
        question: 'Does running an analysis change anything in my org?',
        answer: 'No. Permission Analysis only reads your configuration. Nothing changes until you edit and save permissions yourself.',
      },
      {
        question: 'Can I export permissions for an audit?',
        answer: 'Yes. Every permission grid can be downloaded to Excel, CSV, JSON, or Google Drive.',
      },
    ],
    docLinks: [
      { label: 'Manage permissions', href: `${ROUTES.EXTERNAL.DOCS}/permissions` },
      { label: 'Permission analysis', href: ROUTES.EXTERNAL.DOCS_PERMISSION_ANALYSIS },
    ],
  },
  {
    route: '/bulk-update-salesforce-records',
    name: 'Bulk update Salesforce records',
    title: 'Bulk Update Salesforce Records Without a File | Jetstream',
    description:
      'Update Salesforce records in bulk without exporting a CSV: set a field to a value, copy another field, or clear it across one or many objects. Free to start.',
    eyebrow: 'Mass update',
    heading: 'Bulk update Salesforce records without a spreadsheet',
    lead: 'Choose the objects, pick the field and the new value, and Jetstream updates every matching record. No export, no VLOOKUP, no round trip through a CSV.',
    featuresHeading: 'Mass updates, minus the busywork',
    features: [
      {
        title: 'Set, copy, or clear',
        description: 'Set a field to a value you provide, copy the value from another field, or clear it out.',
      },
      {
        title: 'Target exactly what you mean',
        description:
          'Update all records, only the blank ones, only the non-blank ones, or any set you can describe with a SOQL WHERE clause.',
      },
      {
        title: 'Many objects at once',
        description: 'Apply updates across several objects in one pass, handy for populating External Id fields before a migration.',
      },
      {
        title: 'See the count before you commit',
        description: 'Validate first to see exactly how many records will change, and optionally cap the number of records updated.',
      },
      {
        title: 'Re-trigger automation',
        description: 'Run an update without changing any values to fire a newly activated flow or other automation on existing records.',
      },
      {
        title: 'Update from query results',
        description: 'Already have the records in a query? Bulk update the selection and compare original and new values before saving.',
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
];

export function getIntentPage(route: string): IntentPageContent {
  const page = INTENT_PAGES.find((intentPage) => intentPage.route === route);
  if (!page) {
    throw new Error(`No intent page defined for route ${route}`);
  }
  return page;
}
