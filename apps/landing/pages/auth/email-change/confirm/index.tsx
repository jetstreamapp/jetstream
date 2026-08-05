import { EmailChangeActionWrapper } from '../../../../components/auth/EmailChangeActionWrapper';
import Layout from '../../../../components/layouts/Layout';

export default function Page() {
  return <EmailChangeActionWrapper action="confirm" />;
}

Page.getLayout = function getLayout(page: React.ReactNode) {
  return (
    <Layout title="Confirm Email Change | Jetstream" omitFooter omitNavigation>
      {page}
    </Layout>
  );
};
