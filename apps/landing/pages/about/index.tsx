import { CodeBracketIcon, HeartIcon, LightBulbIcon, ShieldCheckIcon, UserGroupIcon, RocketLaunchIcon } from '@heroicons/react/24/outline';
import Layout from '../../components/layouts/Layout';

const values = [
  {
    name: 'Privacy First',
    description: 'Your data stays where it belongs - with you. We believe in transparent, privacy-focused tools.',
    icon: ShieldCheckIcon,
  },
  {
    name: 'Developer Experience',
    description: 'Built by developers, for developers. Every feature is designed with the end-user experience in mind.',
    icon: CodeBracketIcon,
  },
  {
    name: 'Community Driven',
    description: 'Open source at heart. We listen to our community and build features that solve real problems.',
    icon: UserGroupIcon,
  },
  {
    name: 'Innovation',
    description: "Constantly pushing the boundaries of what's possible with Salesforce tooling and automation.",
    icon: LightBulbIcon,
  },
  {
    name: 'Reliability',
    description: 'Enterprise-grade reliability and performance you can count on for your most critical workflows.',
    icon: RocketLaunchIcon,
  },
  {
    name: 'Passion',
    description: 'We genuinely love what we do and it shows in every feature we ship.',
    icon: HeartIcon,
  },
];

export default function Page() {
  return (
    <div className="bg-gray-900 py-24 sm:pt-16 sm:pb-64">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Hero Section */}
        <div className="mx-auto max-w-4xl text-center">
          <p className="mt-2 text-balance text-5xl font-semibold tracking-tight text-white sm:text-6xl">About Jetstream</p>
        </div>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-center text-lg font-medium text-gray-400 sm:text-xl/8">
          Empowering Salesforce professionals with tools that make complex tasks simple, secure, and efficient.
        </p>

        {/* Mission Section */}
        <div className="mt-16 mx-auto max-w-4xl">
          <div className="bg-white/5 rounded-3xl p-8 lg:p-12">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl mb-6">Our Mission</h2>
            <p className="text-lg leading-8 text-gray-300 mb-6">
              Jetstream exists to bridge the gap between Salesforce's incredible capabilities and the day-to-day challenges faced by
              administrators, developers, and analysts. We believe powerful tools shouldn't require compromising on privacy, security, or
              ease of use.
            </p>
            <p className="text-lg leading-8 text-gray-300">
              What started as a solution to common workflow frustrations has evolved into a comprehensive platform trusted by thousands of
              Salesforce professionals worldwide. We're committed to building tools that respect your data, enhance your productivity, and
              grow with your needs.
            </p>
          </div>
        </div>

        {/* Values Section */}
        <div className="mt-16 mx-auto max-w-4xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Our Values</h2>
            <p className="mt-6 text-lg leading-8 text-gray-300">
              The principles that guide everything we build and every decision we make.
            </p>
          </div>

          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-2">
              {values.map((value) => (
                <div key={value.name} className="flex flex-col">
                  <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-white">
                    <value.icon className="h-5 w-5 flex-none text-cyan-400" aria-hidden="true" />
                    {value.name}
                  </dt>
                  <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-300">
                    <p className="flex-auto">{value.description}</p>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* Founder Section */}
        <div className="mt-16 mx-auto max-w-4xl">
          <div className="bg-gradient-to-r from-cyan-900/20 to-blue-900/20 border border-cyan-500/20 rounded-3xl p-8 lg:p-12">
            <h2 className="text-2xl font-bold tracking-tight text-white mb-6">Leadership</h2>
            <div className="flex flex-col lg:flex-row lg:items-center gap-6">
              <div className="flex-1">
                <p className="text-lg leading-8 text-gray-300 mb-4">
                  Jetstream was founded by{' '}
                  <a
                    href="https://www.linkedin.com/in/p-austin-turner/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 underline"
                  >
                    Austin Turner
                  </a>
                  , a passionate Salesforce developer and architect with over a decade of experience building enterprise solutions on the
                  platform.
                </p>
                <p className="text-lg leading-8 text-gray-300">
                  Austin recognized that while Salesforce provides incredible extensibility, teams often struggled with time-consuming
                  manual processes and limited tooling options. Jetstream was born from the belief that powerful, privacy-focused tools
                  could transform how professionals interact with their Salesforce data.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Community Section */}
        <div className="mt-16 mx-auto max-w-4xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-white mb-6">Join Our Community</h2>
          <p className="text-lg leading-8 text-gray-300 mb-8">
            Jetstream is more than just a tool - it's a community of Salesforce professionals who believe in better ways to work.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://discord.gg/sfxd"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-6 py-3 text-base font-semibold text-white bg-white/10 rounded-lg hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              Join Discord Community
            </a>
            <a
              href="https://github.com/jetstreamapp/jetstream"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-6 py-3 text-base font-semibold text-white bg-white/10 rounded-lg hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

Page.getLayout = function getLayout(page: React.ReactElement) {
  return (
    <Layout title="About | Jetstream" isInverse>
      {page}
    </Layout>
  );
};
