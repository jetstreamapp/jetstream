import React, { Fragment } from 'react';
import Footer from '../../components/Footer';
import Logo from '../../components/Logo';
import { fetchBlogPosts } from '../../utils/data';
import { BlogPost } from '../../utils/types';
// import { GetStaticPaths } from 'next';
import Head from 'next/head';
// WTF - broken
// import favicon from '../../assets/images/favicon.ico';

interface PostProps {
  blogPosts: Array<BlogPost>;
}

function BlogPosts({ blogPosts }: PostProps) {
  // TODO: helmet etc..
  return (
    <Fragment>
      <Head>
        <title>Jetstream Blog</title>
        <meta
          name="description"
          content="Jetstream is a set of tools that supercharge your administration of Salesforce.com. Jetstream is build for administrators, developers, quality assurance, or power users that want to speed up your management of Salesforce. Jetstream comes with an advanced query builder for viewing records, a powerful data loader for making changes to your record data, and many more features!"
        />
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
      <h1>Blog</h1>
      <ul>
        {blogPosts.map((post) => (
          <li key={post.id}>
            <a href={`/blog/posts/${post.slug}`}>{post.title}</a>
          </li>
        ))}
      </ul>

      <Footer currPage="blog" />
    </Fragment>
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
