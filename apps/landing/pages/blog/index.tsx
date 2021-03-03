import React, { Fragment } from 'react';
import Footer from '../../components/Footer';
import Logo from '../../components/Logo';
import { fetchBlogPosts } from '../../utils/data';
import { BlogPost } from '../../utils/types';
// import { GetStaticPaths } from 'next';

interface PostProps {
  blogPosts: Array<BlogPost>;
}

function BlogPosts({ blogPosts }: PostProps) {
  // TODO: helmet etc..
  return (
    <Fragment>
      <h1>Blog</h1>
      <ul>
        {blogPosts.map((post) => (
          <li>
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
