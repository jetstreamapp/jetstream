import { LoginOrSignUpWrapper } from '../../../components/auth/LoginOrSignUpWrapper';
import Layout from '../../../components/layouts/Layout';

export default function Page() {
  return <LoginOrSignUpWrapper action="register" />;
}

Page.getLayout = function getLayout(page) {
  return (
    <Layout title="Sign Up | Jetstream" omitFooter omitNavigation>
      {page}
    </Layout>
  );
};
