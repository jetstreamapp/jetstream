import { Document } from '@contentful/rich-text-types';
import { Asset, Entry, EntryFieldTypes, EntrySkeletonType } from 'contentful';

export interface AnalyticSummaryItem {
  type: 'LOAD_SUMMARY' | 'QUERY_SUMMARY';
  week: number;
  month: number;
  year: number;
}

export interface ContentfulBlogPostField extends EntrySkeletonType {
  contentTypeId: 'blogPost';
  fields: {
    title: EntryFieldTypes.Symbol;
    summary: EntryFieldTypes.Text;
    slug: EntryFieldTypes.Symbol;
    content: EntryFieldTypes.RichText;
    publishDate: EntryFieldTypes.Date;
    author: EntryFieldTypes.EntryLink<ContentfulBlogPostAuthorSkeleton>;
  };
}

export interface ContentfulBlogPostAuthorSkeleton extends EntrySkeletonType {
  contentTypeId: 'author';
  fields: {
    name: EntryFieldTypes.Symbol;
    description?: EntryFieldTypes.Text;
  };
}

export type ContentfulBlogPostAuthor = Entry<ContentfulBlogPostAuthorSkeleton, undefined, string>;

export interface ContentfulIncludes {
  Asset?: Array<Asset>;
  Entry?: Array<ContentfulBlogPostAuthor>;
}

export interface BlogPost {
  id: string;
  title: string;
  summary: string;
  slug: string;
  publishDate: string;
  content: Document;
  author: ContentfulBlogPostAuthor | undefined;
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
