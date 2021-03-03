import { Document } from '@contentful/rich-text-types';
import { Asset, EntryFields, Sys } from 'contentful';

export interface ContentfulBlogPost {
  sys: Sys;
  fields: Array<ContentfulBlogPostField>;
}

export interface ContentfulBlogPostField {
  title: EntryFields.Text;
  summary: EntryFields.Text;
  tags: Array<string>;
  slug: EntryFields.Text;
  content: Document;
  publishDate: string;
  author: {
    sys: {
      type: 'Link';
      linkType: 'Entry';
      id: string;
    };
  };
}
export interface ContentfulBlogPostAuthor {
  sys: Sys;
  fields: {
    name: EntryFields.Text;
    description?: EntryFields.Text;
  };
}

export interface ContentfulIncludes {
  Asset: Array<Asset>;
  Entry: Array<ContentfulBlogPostAuthor>;
}

export interface BlogPost {
  id: string;
  title: string;
  summary: string;
  tags: Array<string>;
  slug: string;
  publishDate: string;
  content: Document;
  author: ContentfulBlogPostAuthor;
  // relatedAssets: AssetsById;
}

export interface BlogPostsBySlug {
  [id: string]: BlogPost;
}

export interface AssetsById {
  [id: string]: Asset;
}

export interface AuthorsById {
  [id: string]: ContentfulBlogPostAuthor;
}
