import {
  ArchiveBoxIcon,
  ArrowTrendingUpIcon,
  BugAntIcon,
  BuildingOfficeIcon,
  CommandLineIcon,
  ShieldCheckIcon,
} from '@heroicons/react/20/solid';

const personas = [
  {
    name: 'Administrators',
    description:
      'Simplify record management, field creation, permission updates, and automation. Jetstream streamlines Salesforce administration.',
    icon: ShieldCheckIcon,
  },
  {
    name: 'Developers & Architects',
    description:
      'Build SOQL queries, explore data models, run Apex, and integrate with the Salesforce API. Jetstream empowers developers and architects.',
    icon: CommandLineIcon,
  },
  {
    name: 'QA Engineers',
    description: 'Accelerate testing with quick access to view, edit, and load records. Jetstream enhances QA efficiency.',
    icon: BugAntIcon,
  },
  {
    name: 'ISVs',
    description: `Leverage the Jetstream Chrome Extension to use the full power of Jetstream in your customer orgs to troubleshoot issues effortlessly. Jetstream simplifies ISV support.`,
    icon: BuildingOfficeIcon,
  },
  {
    name: 'Deployment Managers',
    description: `Compare metadata, deploy changes, and manage org metadata with ease, surpassing Workbench capabilities. Jetstream revolutionizes deployments.`,
    icon: ArchiveBoxIcon,
  },
  {
    name: 'Sales Operations & Revenue Operations',
    description:
      'Access and modify record data directly, eliminating the need for reports or temporary layouts. Jetstream optimizes operations workflows.',
    icon: ArrowTrendingUpIcon,
  },
];

export default function PersonaFeatures() {
  return (
    <div className="bg-gray-900 mt-32 pt-4 pb-24 sm:pt-36 sm:pb-32 lg:pt-4">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:max-w-none">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Features for anyone administering or configuring Salesforce
            </h2>
          </div>

          <dl className="mt-16 mx-auto grid max-w-2xl grid-cols-1 gap-x-6 gap-y-10 text-base/7 text-gray-300 sm:grid-cols-2 lg:mx-0 lg:max-w-none lg:grid-cols-3 lg:gap-x-8 lg:gap-y-16">
            {personas.map((feature) => (
              <div key={feature.name} className="relative pl-9">
                <dt className="inline font-semibold text-white">
                  <feature.icon aria-hidden="true" className="absolute left-1 top-1 size-5 text-cyan-400" />
                  {feature.name}
                </dt>
                {': '}
                <dd className="inline">{feature.description}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
