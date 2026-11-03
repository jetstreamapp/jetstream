import { IntentPage, getIntentPageStructuredData } from '../../components/intent/IntentPage';
import { getIntentPage } from '../../components/intent/intent-pages-data';
import Layout from '../../components/layouts/Layout';

const content = getIntentPage('/bulk-update-salesforce-records');

export default function Page() {
  return <IntentPage content={content} />;
}

Page.getLayout = function getLayout(page) {
  return (
    <Layout isInverse title={content.title} description={content.description} structuredData={getIntentPageStructuredData(content)}>
      {page}
    </Layout>
  );
};
