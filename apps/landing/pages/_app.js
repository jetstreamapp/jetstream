import Layout from '../components/layouts/Layout';
import './index.scss';

export default function MyApp({ Component, pageProps }) {
  // Use page layout or fallback to default inverse layout
  const getLayout = Component.getLayout ?? ((page) => <Layout isInverse>{page}</Layout>);

  return getLayout(<Component {...pageProps} />);
}
