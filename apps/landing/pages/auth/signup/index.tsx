import { LoginOrSignUpWrapper } from '../../../components/auth/LoginOrSignUpWrapper';
import Layout from '../../../components/layouts/Layout';

export default function Page() {
  return <LoginOrSignUpWrapper action="register" />;
}

Page.getLayout = function getLayout(page) {
  return (
    <Layout
      title="Sign Up | Jetstream"
      description="Create a free Jetstream account and connect your Salesforce orgs."
      omitFooter
      omitNavigation
    >
      {page}
    </Layout>
  );
};
