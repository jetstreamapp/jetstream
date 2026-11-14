// DO NOT CHANGE ORDER OF IMPORTS - zod-config must load before anything that creates a schema
import '../utils/zod-config';
// DO NOT CHANGE ORDER OF IMPORTS

import Layout from '../components/layouts/Layout';
import './index.css';

export default function MyApp({ Component, pageProps }) {
  // Use page layout or fallback to default inverse layout
  const getLayout = Component.getLayout ?? ((page) => <Layout isInverse>{page}</Layout>);

  return getLayout(<Component {...pageProps} />);
}
