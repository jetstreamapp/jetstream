import { AcceptTermsWrapper } from '../../../components/auth/AcceptTermsWrapper';
import Layout from '../../../components/layouts/Layout';

export default function Page() {
  return <AcceptTermsWrapper />;
}

Page.getLayout = function getLayout(page: React.ReactNode) {
  return (
    <Layout title="Accept Terms of Service | Jetstream" omitFooter omitNavigation>
      {page}
    </Layout>
  );
};
