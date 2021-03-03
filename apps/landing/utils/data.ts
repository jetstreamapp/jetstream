import { createClient, RichTextContent } from 'contentful';
import { BlogPost, AssetsById, AuthorsById, ContentfulBlogPostField, ContentfulIncludes, BlogPostsBySlug } from './types';

let blogPostsWithRelated: BlogPostsBySlug;

export async function fetchBlogPosts() {
  if (blogPostsWithRelated) {
    return blogPostsWithRelated;
  }

  const client = createClient({
    space: process.env.CONTENTFUL_SPACE,
    accessToken: process.env.CONTENTFUL_TOKEN,
    host: process.env.CONTENTFUL_HOST,
  });

  const entries = await client.getEntries<ContentfulBlogPostField>({
    content_type: 'blogPost',
    order: 'fields.publishDate',
    include: 2,
  });

  const { Asset, Entry } = entries.includes as ContentfulIncludes;

  const assetsById = Asset.reduce((output: AssetsById, item) => {
    output[item.sys.id] = item;
    return output;
  }, {});
  const authorsById = Entry.reduce((output: AuthorsById, item) => {
    output[item.sys.id] = item;
    return output;
  }, {});

  blogPostsWithRelated = entries.items
    .map(
      ({ sys, fields }): BlogPost => {
        return {
          id: sys.id,
          title: fields.title,
          tags: fields.tags,
          slug: fields.slug,
          publishDate: fields.publishDate,
          content: fields.content,
          author: authorsById[fields.author?.sys.id],
          relatedAssets: getRelatedAssets(fields.content.content, assetsById),
        };
      }
    )
    .reduce((output: BlogPostsBySlug, item) => {
      output[item.slug] = item;
      return output;
    }, {});

  return blogPostsWithRelated;
}

function getRelatedAssets(rootContent: RichTextContent[], assetsById: AssetsById, output: AssetsById = {}) {
  return rootContent.reduce((content: AssetsById, item) => {
    if (item.data?.target?.sys.linkType === 'Asset' && assetsById[item.data.target.sys.id]) {
      content[item.data.target.sys.id] = assetsById[item.data.target.sys.id];
    }

    // recursively find any related assets
    if (Array.isArray(item.content)) {
      getRelatedAssets(item.content, assetsById, output);
    }

    return content;
  }, output);
}
