import { CheckIcon, XMarkIcon } from '@heroicons/react/20/solid';
import LastUpdated from '../../components/LastUpdated';
import Layout from '../../components/layouts/Layout';
import { ROUTES } from '../../utils/environment';

const YesIcon = <CheckIcon className="h-6 w-6 text-green-600" aria-hidden="true" />;
const NoIcon = <XMarkIcon className="h-6 w-6 text-gray-600" aria-hidden="true" />;

const webSubProcessors = [
  {
    name: 'BackBlaze',
    function: 'Object storage to store database backups',
    location: 'US',
    optional: NoIcon,
    extension: false,
    desktop: false,
    salesforceCanvas: false,
  },
  {
    name: 'BetterStack',
    function: 'Server logging; alerts; incident management and status page',
    location: 'US',
    optional: NoIcon,
    extension: false,
    desktop: false,
    salesforceCanvas: false,
  },
  {
    name: 'Amplitude',
    function: 'Telemetry',
    location: 'US',
    optional: 'Yes, opt-in via cookie consent banner.',
    extension: false,
    desktop: false,
    salesforceCanvas: false,
  },
  {
    name: 'Cloudflare',
    function: 'CDN / DDoS Protection / WAF / DNS',
    location: 'US',
    optional: NoIcon,
    extension: false,
    desktop: true,
    salesforceCanvas: true,
  },
  {
    name: 'Google Cloud',
    function: 'Identity (if OAuth is used) and optional Google Drive integration.',
    location: 'US',
    optional: 'Yes',
    extension: false,
    desktop: false,
    salesforceCanvas: false,
  },
  {
    name: 'Google Ads',
    function: 'Analytics',
    location: 'US',
    optional: 'Yes, opt-in via cookie consent banner.',
    extension: true,
    desktop: false,
    salesforceCanvas: false,
  },
  {
    name: 'Mailgun',
    function: 'Transactional email',
    location: 'US',
    optional: NoIcon,
    extension: true,
    desktop: true,
    salesforceCanvas: true,
  },
  {
    name: 'Render',
    function: 'Cloud hosting and infrastructure; Data Storage',
    location: 'US',
    optional: NoIcon,
    extension: true,
    desktop: true,
    salesforceCanvas: true,
  },
  {
    name: 'Rollbar',
    function: 'Bug reporting and tracking',
    location: 'US',
    optional: NoIcon,
    extension: false,
    desktop: false,
    salesforceCanvas: false,
  },
  { name: 'Stripe', function: 'Billing', location: 'US', optional: NoIcon, extension: false, desktop: false, salesforceCanvas: false },
  {
    name: 'Salesforce.com',
    function: 'Application Core',
    location: 'US',
    optional: NoIcon,
    extension: true,
    desktop: true,
    salesforceCanvas: true,
  },
].sort((a, b) => a.name.localeCompare(b.name));

export default function Page() {
  return (
    <div className="m-8">
      <LastUpdated className="text-gray-500" day={4} month="January" year={2026} />
      <h1>Jetstream Sub-Processors</h1>
      <p className="mb-2 pl-2">
        This page provides a list of sub-processors that Jetstream uses to provide services to our customers. Our web-based application
        other platforms have a different set of processors and different opt-in/opt-out capabilities.
      </p>
      <p className="mb-2 pl-2">We maintain up-to-date DPAs with each sub-processor.</p>

      <table className="border-collapse border border-gray-400">
        <thead>
          <tr>
            <th className="border border-gray-300 text-left p-3">Sub-Processor Name</th>
            <th className="border border-gray-300 text-left p-3">Function</th>
            <th className="border border-gray-300 text-left p-3">Location</th>
            <th className="border border-gray-300 text-left p-3">Optional</th>
            <th className="border border-gray-300 text-left p-3">Web</th>
            <th className="border border-gray-300 text-left p-3">Browser Extension</th>
            <th className="border border-gray-300 text-left p-3">Desktop</th>
            {/* <th className="text-left p-3">Salesforce Canvas</th> */}
          </tr>
        </thead>
        <tbody>
          {webSubProcessors.map((item) => (
            <tr key={item.name}>
              <td className="border border-gray-300 p-3">{item.name}</td>
              <td className="border border-gray-300 p-3">{item.function}</td>
              <td className="border border-gray-300 p-3">{item.location}</td>
              <td className="border border-gray-300 p-3">{item.optional}</td>
              <td className="border border-gray-300 p-3">{YesIcon}</td>
              <td className="border border-gray-300 p-3">{item.extension ? YesIcon : NoIcon}</td>
              <td className="border border-gray-300 p-3">{item.desktop ? YesIcon : NoIcon}</td>
              {/* <td className="p-3">{item.salesforceCanvas ? {YesIcon} : {NoIcon}}</td> */}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

Page.getLayout = function getLayout(page) {
  return (
    <Layout title="Sub-Processors | Jetstream" navigationProps={{ omitLinks: [ROUTES.SUB_PROCESSORS] }}>
      {page}
    </Layout>
  );
};
