import Head from 'next/head';
import { Fragment } from 'react';
import Footer from '../../components/Footer';
import Navigation from '../../components/Navigation';

const webSubProcessors = [
  { name: 'Amplitude', function: 'Telemetry', location: 'United States', optional: 'No' },
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
  { name: 'Rollbar', function: 'Automated bug tracking', location: 'United States', optional: 'No' },
  { name: 'Salesforce.com', function: 'Application core', location: 'United States', optional: 'No' },
];

function Privacy() {
  return (
    <Fragment>
      <Head>
        <title>Sub-Processors | Jetstream</title>
        <meta
          name="description"
          content="Jetstream is a set of tools that supercharge your administration of Salesforce.com. Jetstream is built for administrators, developers, quality assurance, or power users that want to speed up your management of Salesforce. Jetstream comes with an advanced query builder for viewing records, a powerful data loader for making changes to your record data, and many more features!"
        />
        <link rel="icon" type="image/png" href="/images/favicon.ico"></link>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />

        <meta name="theme-color" content="#ffffff" />

        <link rel="apple-touch-icon" sizes="57x57" href="/assets/images/apple-icon-57x57.png" />
        <link rel="apple-touch-icon" sizes="60x60" href="/assets/images/apple-icon-60x60.png" />
        <link rel="apple-touch-icon" sizes="72x72" href="/assets/images/apple-icon-72x72.png" />
        <link rel="apple-touch-icon" sizes="76x76" href="/assets/images/apple-icon-76x76.png" />
        <link rel="apple-touch-icon" sizes="114x114" href="/assets/images/apple-icon-114x114.png" />
        <link rel="apple-touch-icon" sizes="120x120" href="/assets/images/apple-icon-120x120.png" />
        <link rel="apple-touch-icon" sizes="144x144" href="/assets/images/apple-icon-144x144.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/assets/images/apple-icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/assets/images/apple-icon-180x180.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/assets/images/android-icon-192x192.png" />

        <link rel="manifest" href="/assets/images/manifest.json" />

        <meta name="msapplication-TileColor" content="#ffffff" />
        <meta name="msapplication-TileImage" content="/images/ms-icon-144x144.png" />

        <link rel="icon" type="image/png" sizes="32x32" href="/assets/images/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="96x96" href="/assets/images/favicon-96x96.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/assets/images/favicon-16x16.png" />
      </Head>
      <Navigation />
      <div className="m-8">
        <h1>Jetstream Sub-Processors</h1>
        <p className="mb-2 pl-2">
          This page provides a list of sub-processors that Jetstream uses to provide services to our customers. Our web-based application
          and desktop application have a different set of processors and different opt-in/opt-out capabilities.
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
      <Footer />
    </Fragment>
  );
}

export default Privacy;
