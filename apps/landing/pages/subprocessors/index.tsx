import LastUpdated from '../../components/LastUpdated';
import Layout from '../../components/layouts/Layout';
import { ROUTES } from '../../utils/environment';

const webSubProcessors = [
  { name: 'BackBlaze', function: 'Log storage', location: 'US', optional: 'No', extension: false },
  { name: 'BetterStack', function: 'Server Logging and Status Page', location: 'EU', optional: 'No', extension: false },
  { name: 'Amplitude', function: 'Telemetry', location: 'US', optional: 'Yes, opt-in via cookie consent banner.', extension: false },
  { name: 'Cloudflare', function: 'Infrastructure', location: 'US', optional: 'No', extension: false },
  {
    name: 'Google Cloud',
    function: 'File storage',
    location: 'US',
    optional: 'File storage is opt-in, used if you use Google Drive to save and read files.',
    extension: true,
  },
  {
    name: 'Google Ads',
    function: 'Analytics',
    location: 'US',
    optional: 'Yes, opt-in via cookie consent banner.',
    extension: true,
  },
  {
    name: 'Honeycomb',
    function: 'Server Metrics',
    location: 'US',
    optional: 'No, does not process personal data.',
    extension: false,
  },
  { name: 'Mailgun', function: 'Email', location: 'US', optional: 'No', extension: true },
  { name: 'Render', function: 'Infrastructure / Data Storage', location: 'US', optional: 'No', extension: true },
  { name: 'Rollbar', function: 'Bug Detection and Tracking', location: 'US', optional: 'No', extension: false },
  { name: 'Stripe', function: 'Billing', location: 'US', optional: 'No', extension: false },
  { name: 'Salesforce.com', function: 'Application Core', location: 'US', optional: 'No', extension: true },
];

export default function Page() {
  return (
    <div className="m-8">
      <LastUpdated className="text-gray-500" day={2} month="November" year={2025} />
      <h1>Jetstream Sub-Processors</h1>
      <p className="mb-2 pl-2">
        This page provides a list of sub-processors that Jetstream uses to provide services to our customers. Our web-based application and
        Browser Extension have a different set of processors and different opt-in/opt-out capabilities.
      </p>
      <p className="mb-2 pl-2">We maintain up-to-date DPAs with each sub-processor.</p>
      <h2 className="mt-8">Web-based version of Jetstream</h2>

      <table>
        <thead>
          <tr>
            <th className="text-left p-3">Sub-Processor Name</th>
            <th className="text-left p-3">Function</th>
            <th className="text-left p-3">Location</th>
            <th className="text-left p-3">Optional / Allow opt-out</th>
          </tr>
        </thead>
        <tbody>
          {webSubProcessors.map((item) => (
            <tr key={item.name}>
              <td className="p-3">{item.name}</td>
              <td className="p-3">{item.function}</td>
              <td className="p-3">{item.location}</td>
              <td className="p-3">{item.optional}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mt-8">Browser Extension version of Jetstream</h2>

      <table>
        <thead>
          <tr>
            <th className="text-left p-3">Sub-Processor Name</th>
            <th className="text-left p-3">Function</th>
            <th className="text-left p-3">Location</th>
            <th className="text-left p-3">Optional / Allow opt-out</th>
          </tr>
        </thead>
        <tbody>
          {webSubProcessors
            .filter((item) => item.extension)
            .map((item) => (
              <tr key={item.name}>
                <td className="p-3">{item.name}</td>
                <td className="p-3">{item.function}</td>
                <td className="p-3">{item.location}</td>
                <td className="p-3">{item.optional}</td>
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
