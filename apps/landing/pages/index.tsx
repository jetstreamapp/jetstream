import { PRICING_COPY } from '@jetstream/shared/constants';
import { GetStaticProps } from 'next';
import { FAQ_ITEMS } from '../components/landing/faq-data';
import LandingPage from '../components/landing/LandingPage';
import Layout from '../components/layouts/Layout';
import { SITE_URL } from '../components/layouts/LayoutHead';
import { fetchBlogPosts } from '../utils/data';
import { ROUTES } from '../utils/environment';

const TITLE = 'Jetstream | Salesforce Query Builder, Data Loader & Admin Tools';
const DESCRIPTION =
  'A Salesforce toolkit for admins and developers: SOQL query builder, data loader, permission and automation tools, and metadata compare and deploy. Free to start.';

const STRUCTURED_DATA: Array<Record<string, unknown>> = [
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Jetstream',
    legalName: 'Jetstream Solutions, LLC',
    url: SITE_URL,
    logo: `${SITE_URL}/assets/images/apple-icon-180x180.png`,
    sameAs: ['https://github.com/jetstreamapp', ROUTES.EXTERNAL.APP_EXCHANGE],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Jetstream',
    url: SITE_URL,
  },
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Jetstream',
    description: DESCRIPTION,
    url: SITE_URL,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web, Windows, macOS',
    softwareHelp: { '@type': 'CreativeWork', url: ROUTES.EXTERNAL.DOCS },
    featureList: [
      'Visual SOQL query builder',
      'Data loader for insert, update, upsert, and delete from CSV, Excel, JSON, and Google Sheets',
      'Bulk record updates without a file',
      'Load related objects from a single Excel workbook',
      'Permission management and permission analysis',
      'Automation control for validation rules, workflow rules, flows, and process builders',
      'Metadata compare and deploy between orgs',
      'Anonymous Apex, Apex test runner, debug logs, and platform events',
      'Web app, desktop app, and Chrome and Firefox extension',
    ],
    offers: [
      { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'USD' },
      {
        '@type': 'Offer',
        name: 'Professional',
        price: PRICING_COPY.PRO.monthly.pricePerMonth.replace('$', ''),
        priceCurrency: 'USD',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: PRICING_COPY.PRO.monthly.pricePerMonth.replace('$', ''),
          priceCurrency: 'USD',
          unitText: 'MONTH',
        },
      },
    ],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  },
];

export default function Page() {
  return <LandingPage />;
}

Page.getLayout = function getLayout(page) {
  return (
    <Layout isInverse title={TITLE} description={DESCRIPTION} structuredData={STRUCTURED_DATA}>
      {page}
    </Layout>
  );
};

// This also gets called at build time
export const getStaticProps: GetStaticProps<{
  omitBlogPosts: boolean;
}> = async () => {
  const blogPostsWithRelated = await fetchBlogPosts();
  return { props: { omitBlogPosts: Object.values(blogPostsWithRelated || {}).length === 0 } };
};
