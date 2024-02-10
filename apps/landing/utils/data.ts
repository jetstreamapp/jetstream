import { AnalyticStat } from '@jetstream/types';
import { createClient } from 'contentful';
import numeral from 'numeral';
import { AuthorsById, BlogPost, BlogPostsBySlug, ContentfulBlogPostField, ContentfulIncludes } from './types';

/**
 * EVERYTHING IN THIS FILE MUST ONLY BE USED AT BUILD TIME
 * DO NOT EXPORT ANYTHING WITH A RUNTIME DEPENDENCY
 * ONLY CALL THESE FUNCTIONS WITHIN getStaticProps OR getServerSideProps
 */

let blogPostsBySlug: BlogPostsBySlug;

export async function getAnalyticSummary(): Promise<AnalyticStat[]> {
  const FALLBACK_SUMMARY = {
    LOAD_SUMMARY: {
      id: 'PLACEHOLDER-LOAD_SUMMARY',
      month: 39980754,
      week: 8156954,
      year: 382287645,
      type: 'LOAD_SUMMARY',
      updatedAt: new Date(),
    },
    QUERY_SUMMARY: {
      id: 'PLACEHOLDER-QUERY_SUMMARY',
      month: 50549,
      week: 10425,
      year: 334098,
      type: 'QUERY_SUMMARY',
      updatedAt: new Date(),
    },
  };

  // FIXME: this should call Amplitude API instead of storing/getting from DB
  let results = FALLBACK_SUMMARY;
  if (!process.env.CI) {
    try {
      results = await import('@prisma/client').then(({ PrismaClient }) => {
        return new PrismaClient({ log: ['info'] }).analyticsSummary.findMany().then((result) =>
          result.reduce((acc, item) => {
            acc[item.type] = item;
            return acc;
          }, FALLBACK_SUMMARY)
        );
      });
    } catch (ex) {
      console.log('Error fetching analytics summary - using fallback', ex);
    }
  }

  const summaryStats: AnalyticStat[] = [
    {
      id: `${results.LOAD_SUMMARY.id}-year`,
      name: 'Records loaded in past year',
      value: `${numeral(results.LOAD_SUMMARY.year).format('0a').toUpperCase()}+`,
      valueRaw: results.LOAD_SUMMARY.year,
      lastUpdated: (results.LOAD_SUMMARY?.updatedAt || new Date()).toISOString(),
    },
    {
      id: `${results.LOAD_SUMMARY.id}-month`,
      name: 'Records loaded in past month',
      value: `${numeral(results.LOAD_SUMMARY.month).format('0a').toUpperCase()}+`,
      valueRaw: results.LOAD_SUMMARY.month,
      lastUpdated: (results.LOAD_SUMMARY?.updatedAt || new Date()).toISOString(),
    },
    {
      id: `${results.QUERY_SUMMARY.id}-year`,
      name: 'Queries executed in past year',
      value: `${numeral(results.QUERY_SUMMARY.year).format('0a').toUpperCase()}+`,
      valueRaw: results.QUERY_SUMMARY.year,
      lastUpdated: (results.QUERY_SUMMARY?.updatedAt || new Date()).toISOString(),
    },
    {
      id: `${results.QUERY_SUMMARY.id}-month`,
      name: 'Queries executed in past month',
      value: `${numeral(results.QUERY_SUMMARY.month).format('0a').toUpperCase()}+`,
      valueRaw: results.QUERY_SUMMARY.month,
      lastUpdated: (results.QUERY_SUMMARY?.updatedAt || new Date()).toISOString(),
    },
  ];

  return summaryStats;
}

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
      .map(({ sys, fields }): BlogPost => {
        return {
          id: sys.id,
          title: fields.title,
          summary: fields.summary,
          slug: fields.slug,
          publishDate: fields.publishDate,
          content: fields.content,
          author: authorsById[fields.author?.sys.id],
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
