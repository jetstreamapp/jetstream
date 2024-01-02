import { format, parseISO } from 'date-fns';
import Head from 'next/head';
import Footer from '../../components/Footer';
import Navigation from '../../components/Navigation';
import { fetchBlogPosts } from '../../utils/data';
import { BlogPost } from '../../utils/types';

interface PostProps {
  blogPosts: Array<BlogPost>;
}

function BlogPosts({ blogPosts }: PostProps) {
  // TODO: helmet etc..
  return (
    <div>
      <Head>
        <title>Jetstream Blog</title>
        <meta
          name="description"
          content="Jetstream is a set of tools that supercharge your administration of Salesforce.com. Jetstream is built for administrators, developers, quality assurance, or power users that want to speed up your management of Salesforce. Jetstream comes with an advanced query builder for viewing records, a powerful data loader for making changes to your record data, and many more features!"
        />
        <link rel="icon" type="image/png" href="/images/favicon.ico"></link>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />

        <meta name="theme-color" content="#ffffff" />

        <link rel="apple-touch-icon" sizes="57x57" href="/assets/images/apple-icon-57x57.png" />
        <link rel="apple-touch-icon" sizes="60x60" href="/assets/images/apple-icon-60x60.png" />
        <link rel="apple-touch-icon" sizes="72x72" href="/assets/images/apple-icon-72x72.png" />
        <link rel="apple-touch-icon" sizes="76x76" href="/assets/images/apple-icon-76x76.png" />
        <link rel="apple-touch-icon" sizes="114x114" href="/assets/images/apple-icon-114x114.png" />
        <link rel="apple-touch-icon" sizes="120x120" href="/assets/images/apple-icon-120x120.png" />
        <link rel="apple-touch-icon" sizes="144x144" href="/assets/images/apple-icon-144x144.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/assets/images/apple-icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/assets/images/apple-icon-180x180.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/assets/images/android-icon-192x192.png" />

        <link rel="manifest" href="/assets/images/manifest.json" />

        <meta name="msapplication-TileColor" content="#ffffff" />
        <meta name="msapplication-TileImage" content="/images/ms-icon-144x144.png" />

        <link rel="icon" type="image/png" sizes="32x32" href="/assets/images/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="96x96" href="/assets/images/favicon-96x96.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/assets/images/favicon-16x16.png" />
      </Head>
      <div className="bg-white">
        <div className="relative overflow-hidden">
          <Navigation inverse omitLinks={['/blog']} />
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
          <Footer omitLinks={['/blog']} />
        </div>
      </div>
    </div>
  );
}

// This also gets called at build time
export async function getStaticProps({ params }) {
  // uses cached data
  const blogPostsWithRelated = await fetchBlogPosts();

  // params contains output from getStaticPaths() (I hope)
  // Pass post data to the page via props
  return { props: { blogPosts: Object.values(blogPostsWithRelated) } };
}

export default BlogPosts;
