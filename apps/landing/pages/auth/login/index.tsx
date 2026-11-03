import { LoginOrSignUpWrapper } from '../../../components/auth/LoginOrSignUpWrapper';
import Layout from '../../../components/layouts/Layout';

export default function Page() {
  return <LoginOrSignUpWrapper action="login" />;
}

Page.getLayout = function getLayout(page) {
  return (
    <Layout title="Sign In | Jetstream" description="Sign in to Jetstream to work with your Salesforce orgs." omitFooter omitNavigation>
      {page}
    </Layout>
  );
};
