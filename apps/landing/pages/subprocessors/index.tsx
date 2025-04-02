import Layout from '../../components/layouts/Layout';

const webSubProcessors = [
  { name: 'Amplitude', function: 'Telemetry', location: 'United States', optional: 'No' },
  { name: 'BetterStack', function: 'Server Logging', location: 'Europe', optional: 'No' },
  { name: 'Backblaze', function: 'Log storage', location: 'United States', optional: 'No' },
  { name: 'Cloudflare', function: 'Infrastructure', location: 'United States', optional: 'No' },
  {
    name: 'Cloudinary',
    function: 'Image hosting',
    location: 'United States',
    optional: 'Yes, this processor is only used if you add images while creating a support ticket.',
  },
  {
    name: 'Google',
    function: 'File storage, Page analytics',
    location: 'United States',
    optional: 'File storage is opt-in only if you use Google Drive to save and read files. Google Analytics is not optional.',
  },
  { name: 'Mailgun', function: 'Email', location: 'United States', optional: 'No' },
  { name: 'Render', function: 'Infrastructure', location: 'United States', optional: 'No' },
  { name: 'Sentry', function: 'Automated bug tracking', location: 'United States', optional: 'No' },
  { name: 'Salesforce.com', function: 'Application core', location: 'United States', optional: 'No' },
];

export default function Page() {
  return (
    <div className="m-8">
      <h1>Jetstream Sub-Processors</h1>
      <p className="mb-2 pl-2">
        This page provides a list of sub-processors that Jetstream uses to provide services to our customers. Our web-based application and
        desktop application have a different set of processors and different opt-in/opt-out capabilities.
      </p>
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
    </div>
  );
}

Page.getLayout = function getLayout(page) {
  return <Layout title="Sub-Processors | Jetstream">{page}</Layout>;
};
