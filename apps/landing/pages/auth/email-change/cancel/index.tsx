import { EmailChangeActionWrapper } from '../../../../components/auth/EmailChangeActionWrapper';
import Layout from '../../../../components/layouts/Layout';

export default function Page() {
  return <EmailChangeActionWrapper action="cancel" />;
}

Page.getLayout = function getLayout(page: React.ReactNode) {
  return (
    <Layout title="Cancel Email Change | Jetstream" omitFooter omitNavigation>
      {page}
    </Layout>
  );
};
