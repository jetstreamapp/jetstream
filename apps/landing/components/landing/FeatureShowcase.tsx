'use client';

import { CheckCircleIcon } from '@heroicons/react/20/solid';
import classNames from 'classnames';
import { KeyboardEvent, useCallback, useRef, useState } from 'react';
import { FEATURE_CATEGORIES } from './feature-data';
import { ImageLightbox } from './ImageLightbox';

export const FeatureShowcase = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeCategory = FEATURE_CATEGORIES[activeIndex];
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const handleTabKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      let nextIndex: number | null = null;

      if (event.key === 'ArrowRight') {
        nextIndex = (activeIndex + 1) % FEATURE_CATEGORIES.length;
      } else if (event.key === 'ArrowLeft') {
        nextIndex = (activeIndex - 1 + FEATURE_CATEGORIES.length) % FEATURE_CATEGORIES.length;
      } else if (event.key === 'Home') {
        nextIndex = 0;
      } else if (event.key === 'End') {
        nextIndex = FEATURE_CATEGORIES.length - 1;
      }

      if (nextIndex !== null) {
        event.preventDefault();
        setActiveIndex(nextIndex);
        tabsRef.current[nextIndex]?.focus();
      }
    },
    [activeIndex],
  );

  return (
    <section id="features" className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-cyan-400">Platform Features</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Everything you need, nothing you don&apos;t</h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-400">
            From querying records to deploying metadata, explore what you can do with Jetstream.
          </p>
        </div>

        {/* Tab pills */}
        <div className="mt-12 flex justify-center">
          <div role="tablist" aria-label="Feature categories" className="flex flex-wrap justify-center gap-2 overflow-x-auto p-1">
            {FEATURE_CATEGORIES.map((category, index) => (
              <button
                key={category.id}
                ref={(element) => {
                  tabsRef.current[index] = element;
                }}
                role="tab"
                type="button"
                id={`feature-tab-${category.id}`}
                aria-selected={index === activeIndex}
                aria-controls={`feature-tabpanel-${category.id}`}
                tabIndex={index === activeIndex ? 0 : -1}
                onClick={() => setActiveIndex(index)}
                onKeyDown={handleTabKeyDown}
                className={classNames(
                  'flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400',
                  {
                    'bg-linear-to-r from-teal-500 to-cyan-600 text-white shadow-md': index === activeIndex,
                    'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white': index !== activeIndex,
                  },
                )}
              >
                <category.icon className="h-4 w-4" />
                {category.name}
              </button>
            ))}
          </div>
        </div>

        {/* Active tab content */}
        <div
          key={activeCategory.id}
          role="tabpanel"
          id={`feature-tabpanel-${activeCategory.id}`}
          aria-labelledby={`feature-tab-${activeCategory.id}`}
          className="animate-fadeIn"
        >
          {/* Two-column layout */}
          <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-2">
            {/* Left column */}
            <div>
              <h3 className="text-2xl font-semibold text-white">{activeCategory.hero.title}</h3>
              <p className="mt-4 text-base text-gray-400">{activeCategory.hero.description}</p>
              <ul className="mt-6 space-y-3">
                {activeCategory.hero.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2">
                    <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-teal-500" />
                    <span className="text-sm text-gray-400">{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right column */}
            <div className="overflow-hidden rounded-xl shadow-lg ring-1 ring-white/10">
              <ImageLightbox src={activeCategory.hero.screenshot} alt={activeCategory.hero.screenshotAlt} />
            </div>
          </div>

          {/* Sub-features grid */}
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {activeCategory.subFeatures.map((subFeature) => (
              <div
                key={subFeature.title}
                className="rounded-xl p-5 ring-1 ring-white/10 transition-all duration-200 hover:ring-teal-500/30"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-900/30">
                  <subFeature.icon className="h-5 w-5 text-teal-400" />
                </div>
                <h4 className="mt-3 text-sm font-semibold text-white">{subFeature.title}</h4>
                <p className="mt-1 text-sm text-gray-400">{subFeature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
