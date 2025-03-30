import { GetStaticProps, InferGetStaticPropsType } from 'next';
import LandingPage from '../components/landing/LandingPage';
import { fetchBlogPosts } from '../utils/data';

export default function Page({ omitBlogPosts }: InferGetStaticPropsType<typeof getStaticProps>) {
  return <LandingPage />;
}

// This also gets called at build time
export const getStaticProps: GetStaticProps<{
  omitBlogPosts: boolean;
}> = async () => {
  const blogPostsWithRelated = await fetchBlogPosts();
  return { props: { omitBlogPosts: Object.values(blogPostsWithRelated || {}).length === 0 } };
};
