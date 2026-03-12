import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  BeakerIcon,
  BugAntIcon,
  CircleStackIcon,
  CloudArrowDownIcon,
  CloudArrowUpIcon,
  CodeBracketIcon,
  CogIcon,
  DocumentDuplicateIcon,
  FunnelIcon,
  ListBulletIcon,
  PencilSquareIcon,
  PlusCircleIcon,
  QueueListIcon,
  RectangleStackIcon,
  SignalIcon,
  TableCellsIcon,
  ViewColumnsIcon,
} from '@heroicons/react/20/solid';
import {
  ArrowsRightLeftIcon,
  ArrowUpTrayIcon,
  BoltIcon,
  CommandLineIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';
import { HeroIcon } from './landing-page-data';

export interface SubFeature {
  icon: HeroIcon;
  title: string;
  description: string;
}

export interface FeatureCategory {
  id: string;
  name: string;
  icon: HeroIcon;
  hero: {
    title: string;
    description: string;
    bullets: string[];
    screenshot: string;
    screenshotAlt: string;
  };
  subFeatures: SubFeature[];
}

const SCREENSHOTS = {
  query: 'https://res.cloudinary.com/getjetstream/image/upload/v1773244748/public/website/landing-query-builder_wgxdx2.png',
  load: 'https://res.cloudinary.com/getjetstream/image/upload/v1773244746/public/website/landing-load-records_lmmmkv.png',
  automation:
    'https://res.cloudinary.com/getjetstream/image/upload/v1773244745/public/website/landing-automation-control-results_tnsenq.png',
  permissions: 'https://res.cloudinary.com/getjetstream/image/upload/v1773244744/public/website/landing-permissions-grid_mndfqk.png',
  deploy: 'https://res.cloudinary.com/getjetstream/image/upload/v1773244743/public/website/landing-deploy-grid_feqzrs.png',
  create: 'https://res.cloudinary.com/getjetstream/image/upload/v1773244742/public/website/landing-create-fields-config_wkvxhc.png',
  developer: 'https://res.cloudinary.com/getjetstream/image/upload/v1773244742/public/website/landing-anonymous-apex_uizsfy.png',
};

export const FEATURE_CATEGORIES: FeatureCategory[] = [
  {
    id: 'query',
    name: 'Query & Explore',
    icon: MagnifyingGlassIcon,
    hero: {
      title: 'A query builder that actually saves you time',
      description:
        "Stop writing SOQL by hand in Developer Console. Jetstream's point-and-click query builder lets you explore your data model, pick fields, add filters, and get results in seconds. When you're done, export to your format of choice with one click.",
      bullets: [
        'Visual query builder with object and field picker',
        'Write raw SOQL or use point-and-click, your choice',
        'Filter, sort, and explore related objects visually',
        'Export results to CSV, Excel, JSON, or Google Sheets',
        'View and edit records inline from query results',
      ],
      screenshot: SCREENSHOTS.query,
      screenshotAlt: 'Jetstream SOQL query builder interface',
    },
    subFeatures: [
      {
        icon: TableCellsIcon,
        title: 'Inline Record Editing',
        description: 'Edit records directly from your query results without navigating to Salesforce.',
      },
      {
        icon: FunnelIcon,
        title: 'Advanced Filters',
        description: 'Build complex WHERE clauses visually with nested conditions and subqueries.',
      },
      {
        icon: ArrowDownTrayIcon,
        title: 'Flexible Export',
        description: 'Export to CSV, Excel, JSON, or Google Sheets. Download exactly what you need.',
      },
    ],
  },
  {
    id: 'load',
    name: 'Load & Update',
    icon: ArrowUpTrayIcon,
    hero: {
      title: 'Load data without the headache',
      description:
        'Upload a file, map your fields visually, and go. Insert, update, upsert, or delete records without a separate data loader tool. Jetstream handles bulk operations cleanly and shows you exactly what succeeded or failed. No more guessing.',
      bullets: [
        'Visual field mapping with smart auto-matching',
        'Insert, update, upsert, and delete operations',
        'Bulk API support for large data volumes',
        'Detailed success and error reporting per record',
        'Save and reuse field mappings for repeat loads',
      ],
      screenshot: SCREENSHOTS.load,
      screenshotAlt: 'Jetstream data loader with visual field mapping',
    },
    subFeatures: [
      {
        icon: RectangleStackIcon,
        title: 'Load Related Objects',
        description: 'Load records for multiple related objects at once, parent and child in a single operation.',
      },
      {
        icon: ArrowPathIcon,
        title: 'Mass Update Records',
        description: 'Update or delete records based on criteria you define. No file required.',
      },
      {
        icon: PlusCircleIcon,
        title: 'Create Records',
        description: 'Create new records directly from Jetstream without preparing a file first.',
      },
    ],
  },
  {
    id: 'automation',
    name: 'Automation',
    icon: BoltIcon,
    hero: {
      title: 'See every automation on any object, instantly',
      description:
        'Select any object and see every Flow, Workflow Rule, Process Builder, Validation Rule, and Apex Trigger running against it in one view. No more clicking through setup pages one by one. Debugging automations on a complex org used to take hours. This cuts it to minutes.',
      bullets: [
        'View all automation types for any object in a single screen',
        'Toggle Flows, Triggers, Validation Rules, and Workflow Rules on or off',
        'Quickly identify which automations are active vs. inactive',
        'Essential for debugging complex automation chains',
        'Works across Process Builders, Flows, and legacy automation',
      ],
      screenshot: SCREENSHOTS.automation,
      screenshotAlt: 'Jetstream automation control panel',
    },
    subFeatures: [
      {
        icon: CogIcon,
        title: 'Toggle Automations',
        description: 'Turn individual automations on or off directly, no need to open each one in setup.',
      },
      {
        icon: ListBulletIcon,
        title: 'All Automation Types',
        description: 'Flows, Process Builders, Workflow Rules, Validation Rules, and Apex Triggers in one place.',
      },
    ],
  },
  {
    id: 'permissions',
    name: 'Permissions',
    icon: ShieldCheckIcon,
    hero: {
      title: 'Permission audits in minutes, not hours',
      description:
        'View and edit field-level security and object permissions across profiles and permission sets without clicking through setup endlessly. Compare permissions side by side across profiles. This is a game changer for permission audits and troubleshooting access issues.',
      bullets: [
        'View field-level security across multiple profiles and permission sets',
        'Edit object and field permissions in bulk',
        'Side-by-side comparison of permission sets and profiles',
        'Quickly find and fix permission gaps',
        'Export permission data for compliance documentation',
      ],
      screenshot: SCREENSHOTS.permissions,
      screenshotAlt: 'Jetstream permissions manager matrix view',
    },
    subFeatures: [
      {
        icon: ViewColumnsIcon,
        title: 'Side-by-Side Comparison',
        description: 'Compare permissions across profiles and permission sets to spot differences instantly.',
      },
      {
        icon: PencilSquareIcon,
        title: 'Bulk Edit Permissions',
        description: 'Update field-level security and object permissions across multiple profiles at once.',
      },
    ],
  },
  {
    id: 'deploy',
    name: 'Deploy & Metadata',
    icon: ArrowsRightLeftIcon,
    hero: {
      title: 'Move metadata between orgs with confidence',
      description:
        "Compare metadata between two orgs, see exactly what's different, and deploy changes, all from one screen. Add metadata to an outbound changeset, download it locally, or push it directly to another org. What used to require Workbench or the CLI is now point-and-click.",
      bullets: [
        'Compare metadata between any two orgs side by side',
        'Deploy metadata directly between orgs',
        'Add metadata to an outbound changeset',
        'Download metadata locally: Flows, fields, objects, validation rules, and more',
        'Import and export metadata packages',
      ],
      screenshot: SCREENSHOTS.deploy,
      screenshotAlt: 'Jetstream metadata deployment comparison view',
    },
    subFeatures: [
      {
        icon: DocumentDuplicateIcon,
        title: 'Compare Orgs',
        description: 'See exactly what metadata differs between two orgs before you deploy anything.',
      },
      {
        icon: CloudArrowDownIcon,
        title: 'Download Metadata',
        description: 'Pull Flows, fields, objects, and more locally for documentation or migration prep.',
      },
      {
        icon: CloudArrowUpIcon,
        title: 'Changeset Support',
        description: 'Add metadata to an outbound changeset directly from Jetstream.',
      },
    ],
  },
  {
    id: 'create',
    name: 'Create & Configure',
    icon: WrenchScrewdriverIcon,
    hero: {
      title: 'Build fields and test formulas without setup',
      description:
        'Create new fields on any object directly from Jetstream. Set the field type, label, API name, and help text without navigating through the standard setup UI. Build fields in bulk across objects. Write and validate formula fields against real record data before they go live. No more guessing whether your syntax is correct.',
      bullets: [
        'Create fields on any object without Salesforce setup UI',
        'Bulk field creation across multiple objects',
        'Set field type, label, API name, help text, and more',
        'Formula evaluator: test formulas against real records before deploying',
        'View and update record type picklist value assignments',
      ],
      screenshot: SCREENSHOTS.create,
      screenshotAlt: 'Jetstream field creation and formula evaluator',
    },
    subFeatures: [
      {
        icon: BeakerIcon,
        title: 'Formula Evaluator',
        description: 'Write and validate formula fields against real record data before deploying them.',
      },
      {
        icon: QueueListIcon,
        title: 'Record Type Manager',
        description: 'View and update which picklist values are available on each record type.',
      },
      {
        icon: CircleStackIcon,
        title: 'Bulk Field Creation',
        description: 'Create and update fields in bulk. Faster, cleaner, fewer clicks than setup.',
      },
    ],
  },
  {
    id: 'developer',
    name: 'Developer Tools',
    icon: CommandLineIcon,
    hero: {
      title: 'A developer toolkit that replaces Developer Console',
      description:
        'Execute anonymous Apex with a real code editor, subscribe to and view debug logs in real time, explore the Salesforce API, and monitor Platform Events, all without leaving Jetstream. Everything a Salesforce developer needs, without the pain of Developer Console.',
      bullets: [
        'Execute anonymous Apex with syntax highlighting and auto-complete',
        'Subscribe to and view debug logs without the Developer Console',
        'Interact with the Salesforce REST and SOAP APIs directly',
        'Subscribe to and publish Platform Events',
        'Export object and field metadata for documentation',
      ],
      screenshot: SCREENSHOTS.developer,
      screenshotAlt: 'Jetstream developer tools with anonymous Apex editor',
    },
    subFeatures: [
      {
        icon: CodeBracketIcon,
        title: 'Anonymous Apex',
        description: 'Write and execute Apex with a full-featured code editor, syntax highlighting and all.',
      },
      {
        icon: BugAntIcon,
        title: 'Debug Log Viewer',
        description: 'Subscribe to and view debug logs in real time without Developer Console.',
      },
      {
        icon: SignalIcon,
        title: 'Platform Events',
        description: 'Subscribe to and publish Platform Events for real-time monitoring and testing.',
      },
    ],
  },
];
