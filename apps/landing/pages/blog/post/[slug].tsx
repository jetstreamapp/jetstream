import Head from 'next/head';
import React, { Fragment } from 'react';
import Footer from '../../../components/Footer';
import { fetchBlogPosts } from '../../../utils/data';
import { BlogPost } from '../../../utils/types';
// WTF - broken
// import favicon from '../../assets/images/favicon.ico';

interface PostProps {
  post: BlogPost;
}

function Post({ post }: PostProps) {
  // TODO: helmet etc..
  return (
    <Fragment>
      <Head>
        <title>Jetstream Blog - {post.title}</title>
        <meta name="description" content={`Jetstream blog - ${post.title}.`} />
        {/* <link rel="icon" type="image/png" href={favicon}></link> */}
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
      <h1>{post.title}</h1>
      <div>{post.slug}</div>

      <div className="relative py-16 bg-white overflow-hidden">
        <div className="relative px-4 sm:px-6 lg:px-8">
          <div className="text-lg max-w-prose mx-auto">
            <span className="mt-2 block text-3xl text-center leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              {post.title}
            </span>
          </div>
          <div className="mt-6 prose prose-indigo prose-lg text-gray-500 mx-auto">
            {/* TODO: show all the content here! */}
            {/* show thr data somewhere */}
            {/* show the author somewhere */}
            {/* https://tailwindui.com/components/marketing/sections/content-sections */}
            {post.content.content.map((content) => {
              // TODO: may want to have helper functions return content
              // blockquoer
            })}
          </div>
        </div>
      </div>

      <Footer currPage="blog" />
    </Fragment>
  );
}

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

export default Post;
