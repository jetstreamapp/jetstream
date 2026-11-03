import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { ROUTES } from '../../utils/environment';
import { FaqItem } from './faq-data';

export const FaqSection = ({ items }: { items: FaqItem[] }) => (
  <section id="faq" className="py-24 sm:py-32">
    <div className="mx-auto max-w-3xl px-6 lg:px-8">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-cyan-400">FAQ</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Frequently asked questions</h2>
      </div>

      <div className="mt-12 divide-y divide-white/10 border-y border-white/10">
        {items.map(({ question, answer }) => (
          <details key={question} className="group py-6">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-x-6 text-left text-base font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-400 [&::-webkit-details-marker]:hidden">
              <h3>{question}</h3>
              <ChevronDownIcon aria-hidden="true" className="h-5 w-5 shrink-0 text-gray-400 transition-transform group-open:rotate-180" />
            </summary>
            <p className="mt-4 text-base text-gray-400">{answer}</p>
          </details>
        ))}
      </div>

      <p className="mt-8 text-center text-sm text-gray-400">
        Looking for more detail?{' '}
        <a href={ROUTES.EXTERNAL.DOCS} className="font-semibold text-cyan-400 hover:text-cyan-300">
          Read the documentation
        </a>
      </p>
    </div>
  </section>
);

export default FaqSection;
