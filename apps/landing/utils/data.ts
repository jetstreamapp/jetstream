import { createClient } from 'contentful';
import { AuthorsById, BlogPost, BlogPostsBySlug, ContentfulBlogPostField, ContentfulIncludes } from './types';

let blogPostsBySlug: BlogPostsBySlug;

export async function fetchBlogPosts() {
  if (blogPostsBySlug) {
    return blogPostsBySlug;
  }

  const client = createClient({
    space: process.env.CONTENTFUL_SPACE,
    accessToken: process.env.CONTENTFUL_TOKEN,
    host: process.env.CONTENTFUL_HOST,
  });

  const entries = await client.getEntries<ContentfulBlogPostField>({
    content_type: 'blogPost',
    order: '-fields.publishDate',
    include: 2,
  });

  if (Array.isArray(entries.errors) && entries.errors.length > 0) {
    console.log('[CONTENTFUL ERROR]', JSON.stringify(entries.errors));
    throw new Error('Error with contentful API');
  }

  if (entries.total > 0) {
    const { Entry } = entries.includes as ContentfulIncludes;

    const authorsById = Entry.reduce((output: AuthorsById, item) => {
      output[item.sys.id] = item;
      return output;
    }, {});

    blogPostsBySlug = entries.items
      .map(
        ({ sys, fields }): BlogPost => {
          return {
            id: sys.id,
            title: fields.title,
            summary: fields.summary,
            slug: fields.slug,
            publishDate: fields.publishDate,
            content: fields.content,
            author: authorsById[fields.author?.sys.id],
          };
        }
      )
      .reduce((output: BlogPostsBySlug, item) => {
        output[item.slug] = item;
        return output;
      }, {});
  } else {
    blogPostsBySlug = {};
  }

  return blogPostsBySlug;
}
