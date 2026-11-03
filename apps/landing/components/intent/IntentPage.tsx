import { CheckCircleIcon } from '@heroicons/react/20/solid';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import Link from 'next/link';
import { ROUTES } from '../../utils/environment';
import { FaqSection } from '../landing/FaqSection';
import { FooterCta } from '../landing/FooterCta';
import { SITE_URL } from '../layouts/LayoutHead';
import { INTENT_PAGES, IntentPageContent } from './intent-pages-data';

export function getIntentPageStructuredData({
  route,
  title,
  description,
  name,
  faq,
  comparison,
}: IntentPageContent): Array<Record<string, unknown>> {
  const pageUrl = `${SITE_URL}${route}/`;

  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: title,
      description,
      url: pageUrl,
      ...(comparison && { dateModified: comparison.lastReviewed }),
      isPartOf: { '@type': 'WebSite', name: 'Jetstream', url: SITE_URL },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Jetstream', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name, item: pageUrl },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map(({ question, answer }) => ({
        '@type': 'Question',
        name: question,
        acceptedAnswer: { '@type': 'Answer', text: answer },
      })),
    },
  ];
}

const ComparisonSection = ({ comparison }: { comparison: NonNullable<IntentPageContent['comparison']> }) => {
  const { heading, intro, columns, rows, lastReviewed, footnote } = comparison;

  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-white sm:text-4xl">{heading}</h2>
        <p className="mx-auto mt-6 max-w-2xl text-center text-base text-gray-400">{intro}</p>
        {/* The table scrolls inside its own container so the page never scrolls sideways on phones */}
        <div className="mt-12 overflow-x-auto rounded-xl ring-1 ring-white/10">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="bg-white/5">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold text-white">
                  Feature
                </th>
                {columns.map((column) => (
                  <th key={column} scope="col" className="px-4 py-3 font-semibold text-white">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {rows.map(({ feature, values }) => (
                <tr key={feature}>
                  <th scope="row" className="px-4 py-3 align-top font-medium text-white">
                    {feature}
                  </th>
                  {values.map((value, index) => (
                    <td key={columns[index]} className="px-4 py-3 align-top text-gray-400">
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-gray-400">
          Last reviewed <time dateTime={lastReviewed}>{format(parseISO(lastReviewed), 'MMMM d, y')}</time> from each product&apos;s own
          documentation and store listings.{footnote ? ` ${footnote}` : ''}
        </p>
      </div>
    </section>
  );
};

export const IntentPage = ({ content }: { content: IntentPageContent }) => {
  const { route, eyebrow, heading, lead, featuresHeading, features, comparison, steps, goodToKnow, faq, docLinks } = content;
  const relatedPages = INTENT_PAGES.filter((page) => page.route !== route);

  return (
    <main className="relative isolate overflow-hidden bg-gray-900">
      <div
        aria-hidden="true"
        className="absolute left-[calc(50%-4rem)] top-[10%] -z-10 transform-gpu blur-3xl sm:left-[calc(50%-18rem)] lg:left-48 xl:left-[calc(50%-24rem)]"
      >
        <div
          style={{
            clipPath:
              'polygon(73.6% 51.7%, 91.7% 11.8%, 100% 46.4%, 97.4% 82.2%, 92.5% 84.9%, 75.7% 64%, 55.3% 47.5%, 46.5% 49.4%, 45% 62.9%, 50.3% 87.2%, 21.3% 64.1%, 0.1% 100%, 5.4% 51.1%, 21.4% 63.9%, 58.9% 0.2%, 73.6% 51.7%)',
          }}
          className="aspect-1108/632 w-277 bg-linear-to-r from-[#80caff] to-[#4f46e5] opacity-20"
        />
      </div>

      {/* Hero */}
      <div className="pt-14 pb-16 sm:pt-24 sm:pb-20">
        <div className="mx-auto max-w-4xl px-6 text-center lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-cyan-400">{eyebrow}</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white text-balance sm:text-6xl">{heading}</h1>
          <p className="mx-auto mt-8 max-w-2xl text-lg text-gray-400 sm:text-xl">{lead}</p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link
              href={ROUTES.AUTH.signup}
              className="rounded-md bg-linear-to-r from-teal-500 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:from-teal-600 hover:to-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-gray-900"
            >
              Get started for free
            </Link>
            <a href={docLinks[0].href} className="text-sm font-semibold text-white hover:text-cyan-300">
              Read the docs <span aria-hidden="true">&rarr;</span>
            </a>
          </div>
        </div>
      </div>

      {/* Features */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="text-center text-3xl font-semibold tracking-tight text-white sm:text-4xl">{featuresHeading}</h2>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ title, description }) => (
              <div key={title} className="rounded-xl p-6 ring-1 ring-white/10">
                <h3 className="text-base font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm text-gray-400">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {comparison && <ComparisonSection comparison={comparison} />}

      {/* How it works */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-6 lg:px-8">
          <h2 className="text-center text-3xl font-semibold tracking-tight text-white sm:text-4xl">How it works</h2>
          <ol className="mt-12 space-y-8">
            {steps.map(({ title, description }, index) => (
              <li key={title} className="flex gap-x-5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-900/30 text-sm font-semibold text-teal-400">
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-base font-semibold text-white">{title}</h3>
                  <p className="mt-1 text-sm text-gray-400">{description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Good to know */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-6 lg:px-8">
          <div className="rounded-xl p-8 ring-1 ring-white/10">
            <h2 className="text-xl font-semibold text-white">Good to know</h2>
            <ul className="mt-6 space-y-3">
              {goodToKnow.map((note) => (
                <li key={note} className="flex items-start gap-2">
                  <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-teal-500" />
                  <span className="text-sm text-gray-400">{note}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <FaqSection items={faq} />

      {/* Related pages and docs */}
      <section className="pb-16 sm:pb-24">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-10 px-6 sm:grid-cols-2 lg:px-8">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-cyan-400">Explore more</h2>
            <ul className="mt-4 space-y-3">
              {relatedPages.map(({ route: relatedRoute, name }) => (
                <li key={relatedRoute}>
                  <Link href={`${relatedRoute}/`} className="text-sm text-gray-300 hover:text-white">
                    {name}
                  </Link>
                </li>
              ))}
              <li>
                <Link href={`${ROUTES.HOME}#features`} className="text-sm text-gray-300 hover:text-white">
                  All Jetstream features
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-cyan-400">Documentation</h2>
            <ul className="mt-4 space-y-3">
              {docLinks.map(({ label, href }) => (
                <li key={href}>
                  <a href={href} className="text-sm text-gray-300 hover:text-white">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <FooterCta />
    </main>
  );
};

export default IntentPage;
