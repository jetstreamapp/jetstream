import React, { Fragment } from 'react';
import Footer from '../../../components/Footer';
import Logo from '../../../components/Logo';
import { fetchBlogPosts } from '../../../utils/data';
import { BlogPost } from '../../../utils/types';
// import { GetStaticPaths } from 'next';
import { parseISO } from 'date-fns';

interface PostProps {
  post: BlogPost;
}

function Post({ post }: PostProps) {
  // TODO: helmet etc..
  return (
    <Fragment>
      <h1>{post.title}</h1>
      <div>{post.slug}</div>

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
