import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { renderBlogPostRichText } from '../../../components/blog-post-renderers';
import Footer from '../../../components/Footer';
import LayoutHead, { SITE_URL } from '../../../components/layouts/LayoutHead';
import Navigation from '../../../components/Navigation';
import { fetchBlogPosts } from '../../../utils/data';
import { ROUTES } from '../../../utils/environment';
import { BlogPost } from '../../../utils/types';

interface PostProps {
  post: BlogPost;
}

function Page({ post }: PostProps) {
  return (
    <div>
      <LayoutHead
        title={post.title}
        description={post.summary}
        type="article"
        structuredData={[
          {
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: post.title,
            description: post.summary,
            datePublished: post.publishDate,
            ...(post.author && { author: { '@type': 'Person', name: post.author.fields.name } }),
            publisher: { '@type': 'Organization', name: 'Jetstream', url: SITE_URL },
            mainEntityOfPage: `${SITE_URL}${ROUTES.blogPost(post.slug)}/`,
          },
        ]}
      />

      <div className="bg-white">
        <div className="relative overflow-hidden">
          <Navigation inverse omitLinks={['/blog']} />
          <div className="pb-20 sm:px-6 lg:px-8">
            <div className="text-lg max-w-prose mx-auto text-center py-6">
              <h1 className="mt-2 block text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">{post.title}</h1>
              <div className="my-2 text-gray-500">Published {format(parseISO(post.publishDate), 'MMMM d, y')}</div>
              {post.author && <div>{post.author.fields.name}</div>}
            </div>
            <hr className="my-5" />
            <div className="relative px-4 sm:px-6 lg:px-8">
              <div className="mt-6 text-lg prose max-w-prose prose-blue text-gray-500 mx-auto">{renderBlogPostRichText(post.content)}</div>
            </div>
          </div>

          <Footer omitLinks={['/blog']} />
        </div>
      </div>
    </div>
  );
}

Page.getLayout = function getLayout(page) {
  return (
    // <Layout title="Blog | Jetstream" isInverse navigationProps={{ omitLinks: ['/blog'] }}>
    page
    // </Layout>
  );
};

export const getStaticPaths = async () => {
  const blogPostsWithRelated = await fetchBlogPosts();
  return {
    paths: Object.keys(blogPostsWithRelated).map((slug) => ({ params: { slug } })),
    fallback: false,
  };
};

// This also gets called at build time
export async function getStaticProps({ params }: { params: { slug: string } }) {
  // uses cached data
  const blogPostsWithRelated = await fetchBlogPosts();

  // params contains output from getStaticPaths() (I hope)
  // Pass post data to the page via props
  return { props: { post: blogPostsWithRelated[params.slug] } };
}

export default Page;
