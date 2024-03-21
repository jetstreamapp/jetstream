import { AnalyticStat } from '@jetstream/types';
import { GetStaticProps, InferGetStaticPropsType } from 'next';
import Head from 'next/head';
import Footer from '../components/Footer';
import Navigation from '../components/Navigation';
import LandingPage from '../components/new/LandingPage';
import { fetchBlogPosts, getAnalyticSummary } from '../utils/data';

export const Index = ({ stats, omitBlogPosts }: InferGetStaticPropsType<typeof getStaticProps>) => {
  return (
    <div>
      <Head>
        <title>Jetstream</title>
        <meta
          name="description"
          content="Jetstream is a set of tools that supercharge your administration of Salesforce.com. Jetstream is built for administrators, developers, quality assurance, or power users that want to speed up your management of Salesforce. Jetstream comes with an advanced query builder for viewing records, a powerful data loader for making changes to your record data, and many more features!"
        />
        <meta
          name="og:description"
          content="Jetstream is a set of tools that supercharge your administration of Salesforce.com. Jetstream is built for administrators, developers, quality assurance, or power users that want to speed up your management of Salesforce. Jetstream comes with an advanced query builder for viewing records, a powerful data loader for making changes to your record data, and many more features!"
        />

        <meta
          name="image"
          content="https://res.cloudinary.com/getjetstream/image/upload/b_rgb:ffffff,bo_3px_solid_rgb:ffffff,pg_1/v1634516631/public/jetstream-logo-1200w.png"
        />
        <meta
          name="og:image"
          content="https://res.cloudinary.com/getjetstream/image/upload/b_rgb:ffffff,bo_3px_solid_rgb:ffffff,pg_1/v1634516631/public/jetstream-logo-1200w.png"
        />
        <meta
          name="twitter:image"
          content="https://res.cloudinary.com/getjetstream/image/upload/b_rgb:ffffff,bo_3px_solid_rgb:ffffff,pg_1/v1634516631/public/jetstream-logo-1200w.png"
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
          <LandingPage stats={stats} />
          <Footer />
        </div>
      </div>
    </div>
  );
};

// This also gets called at build time
export const getStaticProps: GetStaticProps<{
  stats: AnalyticStat[];
  omitBlogPosts: boolean;
}> = async () => {
  const stats = await getAnalyticSummary();
  const blogPostsWithRelated = await fetchBlogPosts();
  return { props: { stats, omitBlogPosts: Object.values(blogPostsWithRelated || {}).length === 0 } };
};

export default Index;
