import Head from 'next/head';
import { FooterProps } from '../Footer';
import { NavigationProps } from '../Navigation';
import Layout from './Layout';

export default function AuthPageLayout(props: {
  title?: string;
  isInverse?: boolean;
  navigationProps?: Omit<NavigationProps, 'userProfile'>;
  footerProps?: FooterProps;
  omitNavigation?: boolean;
  omitFooter?: boolean;
  userHeaderWithoutNavigation?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Layout {...props}>
      <Head>
        <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
      </Head>
      {props.children}
    </Layout>
  );
}
