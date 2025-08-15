import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import Layout from '../../components/layouts/Layout';
import { fetchBlogPosts } from '../../utils/data';
import { BlogPost } from '../../utils/types';

interface PostProps {
  blogPosts: Array<BlogPost>;
}

export default function Page({ blogPosts }: PostProps) {
  // TODO: helmet etc..
  return (
    <>
      {blogPosts.length === 0 && (
        <div className="text-center pt-8 text-gray-500">There aren't any blog posts right now, check back soon.</div>
      )}
      <div className="py-8">
        {blogPosts.map((post, i) => (
          <div key={post.id}>
            {i !== 0 && <hr className="my-5" />}
            <div className="flex justify-center">
              <div className="w-full md:w-6/12 xl:w-4/12 px-6 md:px-0">
                <h3 className="text-xl">
                  <a href={`/blog/post/${post.slug}`}>{post.title}</a>
                </h3>
                <p className="my-2 text-gray-500 text-sm">{format(parseISO(post.publishDate), 'MMMM d, y')}</p>
                <section className="text-sm mt-4">{post.summary}</section>
                <div className="mt-8">
                  <a className="text-blue-700" href={`/blog/post/${post.slug}`}>
                    Read More
                  </a>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

Page.getLayout = function getLayout(page) {
  return (
    <Layout title="Blog | Jetstream" isInverse>
      {page}
    </Layout>
  );
};

// This also gets called at build time
export async function getStaticProps({ params }) {
  // uses cached data
  const blogPostsWithRelated = await fetchBlogPosts();

  // params contains output from getStaticPaths() (I hope)
  // Pass post data to the page via props
  return { props: { blogPosts: Object.values(blogPostsWithRelated) } };
}
