import {
  ChatBubbleLeftRightIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  CircleStackIcon,
  CodeBracketIcon,
  Cog6ToothIcon,
  ComputerDesktopIcon,
  GlobeAltIcon,
  HeartIcon,
  PuzzlePieceIcon,
  RocketLaunchIcon,
} from '@heroicons/react/24/outline';
import { ForwardRefExoticComponent, RefAttributes, SVGProps } from 'react';
import { ENVIRONMENT, ROUTES } from '../../utils/environment';

export type HeroIcon = ForwardRefExoticComponent<
  Omit<SVGProps<SVGSVGElement>, 'ref'> & {
    title?: string;
    titleId?: string;
  } & RefAttributes<SVGSVGElement>
>;

export interface TrustSignal {
  icon: HeroIcon;
  title: string;
  description: string;
}

export interface ValuePillar {
  icon: HeroIcon;
  title: string;
  description: string;
  features: string[];
}

export interface PlatformOption {
  icon: HeroIcon;
  name: string;
  description: string;
  cta: string;
  href: string;
}

export interface PricingTier {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  href: string;
  highlighted: boolean;
}

export interface CommunityStat {
  label: string;
  value: string;
}

export interface CommunityLink {
  icon: HeroIcon;
  title: string;
  description: string;
  href: string;
}

export const VALUE_PILLARS: ValuePillar[] = [
  {
    icon: CircleStackIcon,
    title: 'Work with Data',
    description: 'Query, load, and manage Salesforce records with visual tools that replace manual SOQL and data loaders.',
    features: [
      'Visual SOQL query builder',
      'Data loader with field mapping',
      'Inline record editing',
      'Export to CSV, Excel, or Google Sheets',
    ],
  },
  {
    icon: Cog6ToothIcon,
    title: 'Manage Your Org',
    description: 'Control automations, audit permissions, create fields, and configure your org without setup page fatigue.',
    features: ['Automation control panel', 'Permission audits in minutes', 'Bulk field creation', 'Formula evaluator'],
  },
  {
    icon: RocketLaunchIcon,
    title: 'Deploy & Develop',
    description: 'Compare and deploy metadata between orgs, execute Apex, explore APIs, and monitor platform events.',
    features: ['Metadata comparison & deployment', 'Anonymous Apex execution', 'Debug log viewer', 'Platform event monitoring'],
  },
];

export const PLATFORM_OPTIONS: PlatformOption[] = [
  {
    icon: GlobeAltIcon,
    name: 'Web App',
    description: 'Access Jetstream from any browser. Connect your Salesforce orgs and get to work in seconds.',
    cta: 'Open Jetstream',
    href: ENVIRONMENT.CLIENT_URL,
  },
  {
    icon: ComputerDesktopIcon,
    name: 'Desktop App',
    description: 'Native desktop experience for macOS and Windows. Your data flows directly to Salesforce — never through our servers.',
    cta: 'Learn more',
    href: ROUTES.DESKTOP,
  },
  {
    icon: PuzzlePieceIcon,
    name: 'Browser Extension',
    description: 'Quick access from Chrome or Firefox. Launch Jetstream tools without leaving your current tab.',
    cta: 'Learn more',
    href: ROUTES.BROWSER_EXTENSIONS,
  },
];

export const PRICING_TIERS: PricingTier[] = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    description: 'Access to all core features',
    features: ['Unlimited Salesforce orgs', 'Query builder & data loader', 'Metadata tools & deployment', 'Developer tools & API access'],
    cta: 'Get started for free',
    href: ROUTES.AUTH.signup,
    highlighted: false,
  },
  {
    name: 'Professional',
    price: '$25',
    period: '/month',
    description: 'Perfect for individual power users',
    features: ['Everything in Free', 'Desktop application', 'Browser extensions', 'Google Drive integration', 'Priority support'],
    cta: 'Get started',
    href: ROUTES.AUTH.signup,
    highlighted: true,
  },
  {
    name: 'Team',
    price: '$125',
    period: '/month',
    description: 'Includes 5 users ($25/user/month)',
    features: ['Everything in Professional', 'Up to 20 team members', 'SSO (SAML & OIDC)', 'Role-based access control'],
    cta: 'Get started',
    href: ROUTES.AUTH.signup,
    highlighted: false,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'Advanced features for large teams',
    features: ['Everything in Team', 'Unlimited team members', 'Custom agreements & terms', 'Dedicated account manager'],
    cta: 'Contact sales',
    href: 'mailto:sales@getjetstream.app?subject=Enterprise Plan Inquiry',
    highlighted: false,
  },
];

export const COMMUNITY_STATS: CommunityStat[] = [
  { label: 'GitHub Stars', value: '2,000+' },
  { label: 'Discord Members', value: '1,500+' },
  { label: 'Features Shipped', value: '200+' },
  { label: 'Years Active', value: '5+' },
];

export const COMMUNITY_LINKS: CommunityLink[] = [
  {
    icon: CodeBracketIcon,
    title: 'Star us on GitHub',
    description: 'Browse the source, file issues, and contribute.',
    href: 'https://github.com/jetstreamapp/jetstream',
  },
  {
    icon: ChatBubbleLeftRightIcon,
    title: 'Join the community',
    description: 'Ask questions, share tips, and connect with other Salesforce pros.',
    href: ROUTES.EXTERNAL.DISCORD,
  },
  {
    icon: ChatBubbleOvalLeftEllipsisIcon,
    title: 'Start a discussion',
    description: 'Propose features, share ideas, and give feedback.',
    href: 'https://github.com/jetstreamapp/jetstream/discussions',
  },
  {
    icon: HeartIcon,
    title: 'Sponsor the project',
    description: "Support Jetstream's continued development.",
    href: ROUTES.EXTERNAL.GITHUB_SPONSOR,
  },
];
