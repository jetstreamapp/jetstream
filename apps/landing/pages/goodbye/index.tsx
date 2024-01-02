import Head from 'next/head';
import Link from 'next/link';
import { Fragment } from 'react';
import Footer from '../../components/Footer';
import Navigation from '../../components/Navigation';

function Goodbye() {
  const email = 'support@getjetstream.app';
  return (
    <Fragment>
      <Head>
        <title>Jetstream</title>
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
      <main className="flex-grow flex flex-col justify-center max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 sm:my-4 md:my-12">
        <div className="py-16">
          <div className="text-center">
            <p className="text-sm font-semibold text-cyan-600 uppercase tracking-wide">Goodbye</p>
            <h1 className="mt-2 text-4xl font-extrabold text-gray-900 tracking-tight sm:text-5xl">We're sorry to see you go!</h1>
            <p className="mt-2 text-base text-gray-500">We would love to have you back in the future!</p>
            <p className="mt-2 text-base text-gray-500">
              Don't hesitate to reach out to us via email at{' '}
              <a
                href="mailto:support@getjetstream.app"
                className="text-cyan-600 hover:text-cyan-500 hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                {email}
              </a>{' '}
              if you have any questions or have feedback on what we can do better.
            </p>
            <div className="mt-6">
              <Link href="/" className="text-base font-medium text-cyan-600 hover:text-cyan-500">
                Go back home<span aria-hidden="true"> &rarr;</span>
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </Fragment>
  );
}

export default Goodbye;
