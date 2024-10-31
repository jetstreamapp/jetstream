import { VerifyEmailOr2faWrapper } from '../../../components/auth/VerifyEmailOr2faWrapper';
import Layout from '../../../components/layouts/Layout';

export default function Page() {
  return <VerifyEmailOr2faWrapper />;
}

Page.getLayout = function getLayout(page) {
  return (
    <Layout title="Verify Authentication | Jetstream" omitFooter omitNavigation>
      {page}
    </Layout>
  );
};
