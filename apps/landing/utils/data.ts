import { createClient } from 'contentful';
import { AuthorsById, BlogPost, BlogPostsBySlug, ContentfulBlogPostField, ContentfulIncludes } from './types';

/**
 * EVERYTHING IN THIS FILE MUST ONLY BE USED AT BUILD TIME
 * DO NOT EXPORT ANYTHING WITH A RUNTIME DEPENDENCY
 * ONLY CALL THESE FUNCTIONS WITHIN getStaticProps OR getServerSideProps
 */

let blogPostsBySlug: BlogPostsBySlug;

export async function fetchBlogPosts() {
  if (blogPostsBySlug) {
    return blogPostsBySlug;
  }

  if (!process.env.CONTENTFUL_SPACE || !process.env.CONTENTFUL_TOKEN || !process.env.CONTENTFUL_HOST) {
    blogPostsBySlug = {};
    return blogPostsBySlug;
  }

  const client = createClient({
    space: process.env.CONTENTFUL_SPACE,
    accessToken: process.env.CONTENTFUL_TOKEN,
    host: process.env.CONTENTFUL_HOST,
  });

  const entries = await client.getEntries<ContentfulBlogPostField>({
    content_type: 'blogPost',
    order: ['-fields.publishDate'],
    include: 2,
  });

  if (Array.isArray(entries.errors) && entries.errors.length > 0) {
    console.log('[CONTENTFUL ERROR]', JSON.stringify(entries.errors));
    throw new Error('Error with contentful API');
  }

  if (entries.total > 0) {
    const includes = entries.includes as unknown as ContentfulIncludes;
    const Entry = includes?.Entry || [];

    const authorsById = Entry.reduce((output: AuthorsById, item) => {
      output[item.sys.id] = item;
      return output;
    }, {});

    blogPostsBySlug = entries.items
      .map(({ sys, fields }): BlogPost => {
        const authorId = fields.author?.sys?.id;
        return {
          id: sys.id,
          title: fields.title,
          summary: fields.summary,
          slug: fields.slug,
          publishDate: fields.publishDate,
          content: fields.content,
          author: authorId ? authorsById[authorId] : undefined,
        };
      })
      .reduce((output: BlogPostsBySlug, item) => {
        output[item.slug] = item;
        return output;
      }, {});
  } else {
    blogPostsBySlug = {};
  }

  return blogPostsBySlug;
}
