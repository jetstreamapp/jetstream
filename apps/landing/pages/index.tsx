import { AnalyticStat } from '@jetstream/types';
import { GetStaticProps, InferGetStaticPropsType } from 'next';
import LandingPage from '../components/landing/LandingPage';
import { fetchAnalyticsSummary, fetchBlogPosts } from '../utils/data';

export default function Page({ stats }: InferGetStaticPropsType<typeof getStaticProps>) {
  return <LandingPage stats={stats} />;
}

// This also gets called at build time
export const getStaticProps: GetStaticProps<{
  stats: AnalyticStat[] | null;
}> = async () => {
  const [blogPostsWithRelated, stats] = await Promise.all([fetchBlogPosts(), fetchAnalyticsSummary()]);
  // omitBlogPosts was unused by LandingPage, so we drop it here
  void blogPostsWithRelated;
  return { props: { stats } };
};
