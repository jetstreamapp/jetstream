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
      'Manage records, create fields, update permissions, and easily manage automation. Jetstream is the perfect tool for Salesforce Admins.',
    icon: ShieldCheckIcon,
  },
  {
    name: 'Developers',
    description:
      'Build SOQL queries, explore your data model, run Apex, subscribe and publish to Platform Events, and work with the Salesforce API.',
    icon: CommandLineIcon,
  },
  {
    name: 'QA Engineers',
    description: 'Quickly view, edit, and load records to test system functionality.',
    icon: BugAntIcon,
  },
  {
    name: 'Architects',
    description: 'Jetstream simplifies data-model exploration. Design solutions faster than ever.',
    icon: BuildingOfficeIcon,
  },
  {
    name: 'Deployment Managers',
    description: 'Compare metadata, deploy changes, and manage your Salesforce orgs without hassle.',
    icon: ArchiveBoxIcon,
  },
  {
    name: 'Revenue Operations',
    description:
      'If you handle both rev-ops and admin tasks, Jetstream provides quick access to data—no tedious Salesforce reports required.',
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
