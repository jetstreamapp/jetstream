import Head from 'next/head';
import Footer from '../../components/Footer';
import Navigation from '../../components/Navigation';
import { BlogPost } from '../../utils/types';

interface PostProps {
  blogPosts: Array<BlogPost>;
}

function About({ blogPosts }: PostProps) {
  return (
    <div>
      <Head>
        <title>About Jetstream</title>
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
      <div className="bg-white">
        <div className="relative overflow-hidden">
          <Navigation inverse />
          <div className="bg-gray-50 py-24 sm:py-32 border-b border-b-gray-200">
            <div className="mx-auto max-w-md px-6 sm:max-w-lg lg:max-w-7xl lg:px-8">
              <h1 className="text-center text-4xl font-bold leading-10 tracking-tight text-gray-900 sm:text-5xl sm:leading-none lg:text-6xl">
                About Jetstream
              </h1>
              <p className="mx-auto mt-6 max-w-3xl text-center text-xl leading-normal text-gray-500">
                Jetstream is a source-available project created and maintained{' '}
                <a
                  href="https://www.linkedin.com/in/p-austin-turner/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-500 hover:text-cyan-900"
                >
                  Austin Turner
                </a>
                .
              </p>
              <p className="mx-auto mt-6 max-w-3xl text-center text-xl leading-normal text-gray-500">
                I created Jetstream as a side project to solve common problems that my co-workers and I faced on a daily basis. Salesforce
                is an amazing platform with a lot of extensibility, but it can be difficult to manage and maintain.
              </p>
              <p className="mx-auto mt-6 max-w-3xl text-center text-xl leading-normal text-gray-500">
                I truly hope that you love Jetstream as much as I do!
              </p>
            </div>
          </div>
          <Footer />
        </div>
      </div>
    </div>
  );
}

export default About;
