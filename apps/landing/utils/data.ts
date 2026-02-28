import { AnalyticStat } from '@jetstream/types';
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

const AMPLITUDE_CHART_IDS = {
  LOAD: { YEAR: 'jgshgwcl', MONTH: 'iyt2blcf' },
  QUERY: { YEAR: '4lacgp5q', MONTH: 'icruamqk' },
  FIELD_CREATION: { YEAR: 'tyu5pjug', MONTH: 'adzowzyc' },
  APEX_EXECUTED: { YEAR: 'afxl6h2d' },
  DEPLOYMENTS: { YEAR: 'rz9tpgjy', MONTH: '262an8ek' },
};

function formatStatValue(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B+`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M+`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}K+`;
  }
  return value.toLocaleString();
}

async function fetchAmplitudeChart(chartId: string, authHeader: string): Promise<number> {
  const response = await fetch(`https://amplitude.com/api/3/chart/${chartId}/query`, {
    headers: { Authorization: authHeader },
  });
  if (!response.ok) {
    throw new Error(`Amplitude API error for chart ${chartId}: ${response.status}`);
  }
  const data = await response.json();
  return data.data.seriesCollapsed[0][0].value;
}

export async function fetchAnalyticsSummary(): Promise<AnalyticStat[] | null> {
  if (!process.env.AMPLITUDE_API_KEY || !process.env.AMPLITUDE_SECRET_KEY) {
    return null;
  }

  try {
    const authHeader = `Basic ${Buffer.from(`${process.env.AMPLITUDE_API_KEY}:${process.env.AMPLITUDE_SECRET_KEY}`).toString('base64')}`;

    const loadYear = await fetchAmplitudeChart(AMPLITUDE_CHART_IDS.LOAD.YEAR, authHeader);
    const loadMonth = await fetchAmplitudeChart(AMPLITUDE_CHART_IDS.LOAD.MONTH, authHeader);

    const queryYear = await fetchAmplitudeChart(AMPLITUDE_CHART_IDS.QUERY.YEAR, authHeader);
    const queryMonth = await fetchAmplitudeChart(AMPLITUDE_CHART_IDS.QUERY.MONTH, authHeader);

    const fieldCreationYear = await fetchAmplitudeChart(AMPLITUDE_CHART_IDS.FIELD_CREATION.YEAR, authHeader);
    const fieldCreationMonth = await fetchAmplitudeChart(AMPLITUDE_CHART_IDS.FIELD_CREATION.MONTH, authHeader);

    const deploymentsYear = await fetchAmplitudeChart(AMPLITUDE_CHART_IDS.DEPLOYMENTS.YEAR, authHeader);
    const deploymentsMonth = await fetchAmplitudeChart(AMPLITUDE_CHART_IDS.DEPLOYMENTS.MONTH, authHeader);

    const lastUpdated = new Date().toISOString();

    return [
      { id: 'load-year', name: 'Records loaded in the past year', value: formatStatValue(loadYear), valueRaw: loadYear, lastUpdated },
      { id: 'load-month', name: 'Records loaded in the past month', value: formatStatValue(loadMonth), valueRaw: loadMonth, lastUpdated },
      { id: 'query-year', name: 'SOQL queries run in the past year', value: formatStatValue(queryYear), valueRaw: queryYear, lastUpdated },
      {
        id: 'query-month',
        name: 'SOQL queries run in the past month',
        value: formatStatValue(queryMonth),
        valueRaw: queryMonth,
        lastUpdated,
      },
      {
        id: 'field-creation-year',
        name: 'Fields created in the past year',
        value: formatStatValue(fieldCreationYear),
        valueRaw: fieldCreationYear,
        lastUpdated,
      },
      {
        id: 'field-creation-month',
        name: 'Fields created in the past month',
        value: formatStatValue(fieldCreationMonth),
        valueRaw: fieldCreationMonth,
        lastUpdated,
      },
      {
        id: 'deployments-year',
        name: 'Deployments in the past year',
        value: formatStatValue(deploymentsYear),
        valueRaw: deploymentsYear,
        lastUpdated,
      },
      {
        id: 'deployments-month',
        name: 'Deployments in the past month',
        value: formatStatValue(deploymentsMonth),
        valueRaw: deploymentsMonth,
        lastUpdated,
      },
    ];
  } catch (error) {
    console.error('[ANALYTICS SUMMARY] Error fetching analytics from Amplitude:', error);
    return null;
  }
}
