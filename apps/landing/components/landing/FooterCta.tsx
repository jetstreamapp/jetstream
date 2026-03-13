import Link from 'next/link';
import { ROUTES } from '../../utils/environment';

export function FooterCta() {
  return (
    <section className="relative isolate overflow-hidden bg-gray-900 py-24 sm:py-32">
      {/* Gradient blur blob */}
      <div aria-hidden="true" className="absolute inset-x-0 top-10 -z-10 flex transform-gpu justify-center overflow-hidden blur-3xl">
        <div
          style={{
            clipPath:
              'polygon(73.6% 51.7%, 91.7% 11.8%, 100% 46.4%, 97.4% 82.2%, 92.5% 84.9%, 75.7% 64%, 55.3% 47.5%, 46.5% 49.4%, 45% 62.9%, 50.3% 87.2%, 21.3% 64.1%, 0.1% 100%, 5.4% 51.1%, 21.4% 63.9%, 58.9% 0.2%, 73.6% 51.7%)',
          }}
          className="aspect-1108/632 w-277 flex-none bg-linear-to-r from-[#80caff] to-[#4f46e5] opacity-20"
        />
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-6 text-center lg:px-8">
        <h2 className="text-3xl font-semibold tracking-tight text-balance text-white sm:text-5xl">Stop switching between tools</h2>
        <p className="mx-auto mt-6 max-w-xl text-lg text-gray-400">
          Become a Salesforce power user with Jetstream. It&apos;s free to get started.
        </p>
        <div className="mt-10 inline-flex">
          <Link
            href={ROUTES.AUTH.signup}
            className="rounded-md bg-linear-to-r from-teal-500 to-cyan-600 px-6 py-3 text-base font-semibold text-white shadow-lg transition-all duration-200 hover:from-teal-600 hover:to-cyan-700"
          >
            Get started for free
          </Link>
        </div>
      </div>
    </section>
  );
}
