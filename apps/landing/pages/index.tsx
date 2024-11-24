import { AnalyticStat } from '@jetstream/types';
import { GetStaticProps, InferGetStaticPropsType } from 'next';
import LandingPage from '../components/landing/LandingPage';
import { fetchBlogPosts, getAnalyticSummary } from '../utils/data';

export default function Page({ stats, omitBlogPosts }: InferGetStaticPropsType<typeof getStaticProps>) {
  return <LandingPage stats={stats} />;
}

// This also gets called at build time
export const getStaticProps: GetStaticProps<{
  stats: AnalyticStat[];
  omitBlogPosts: boolean;
}> = async () => {
  const stats = await getAnalyticSummary();
  const blogPostsWithRelated = await fetchBlogPosts();
  return { props: { stats, omitBlogPosts: Object.values(blogPostsWithRelated || {}).length === 0 } };
};
