import Link from 'next/link';
import { ROUTES } from '../../utils/environment';

export const HeaderCta = () => (
  <div data-testid="home-hero-container" className="relative isolate overflow-hidden  bg-gray-900 pb-16 pt-14 sm:pb-20">
    <svg
      aria-hidden="true"
      className="absolute inset-0 -z-10 size-full stroke-white/10 mask-[radial-gradient(100%_100%_at_top_right,white,transparent)]"
    >
      <defs>
        <pattern x="50%" y={-1} id="header-cta-pattern" width={200} height={200} patternUnits="userSpaceOnUse">
          <path d="M.5 200V.5H200" fill="none" />
        </pattern>
      </defs>
      <svg x="50%" y={-1} className="overflow-visible fill-gray-800/20">
        <path d="M-200 0h201v201h-201Z M600 0h201v201h-201Z M-400 600h201v201h-201Z M200 800h201v201h-201Z" strokeWidth={0} />
      </svg>
      <rect fill="url(#header-cta-pattern)" width="100%" height="100%" strokeWidth={0} />
    </svg>
    <div
      aria-hidden="true"
      className="absolute left-[calc(50%-4rem)] top-10 -z-10 transform-gpu blur-3xl sm:left-[calc(50%-18rem)] lg:left-48 lg:top-[calc(50%-30rem)] xl:left-[calc(50%-24rem)]"
    >
      <div
        style={{
          clipPath:
            'polygon(73.6% 51.7%, 91.7% 11.8%, 100% 46.4%, 97.4% 82.2%, 92.5% 84.9%, 75.7% 64%, 55.3% 47.5%, 46.5% 49.4%, 45% 62.9%, 50.3% 87.2%, 21.3% 64.1%, 0.1% 100%, 5.4% 51.1%, 21.4% 63.9%, 58.9% 0.2%, 73.6% 51.7%)',
        }}
        className="aspect-1108/632 w-277 bg-linear-to-r from-[#80caff] to-[#4f46e5] opacity-20"
      />
    </div>
    <div className="mx-auto max-w-2xl py-32 sm:py-48 lg:py-56">
      <div className="text-center">
        <div className="hidden sm:mb-8 sm:flex sm:justify-center">
          <div className="relative rounded-full px-3 py-1 text-sm/6 text-gray-400 ring-1 ring-white/10 hover:ring-white/20">
            SSO is now available
            <Link href={ROUTES.blogPost('jetstream-sso')} className="font-semibold text-white ml-2">
              <span aria-hidden="true" className="absolute inset-0" />
              Read more <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        </div>
        <h1 className="text-balance text-5xl font-semibold tracking-tight text-white sm:text-7xl">A simpler way to build on Salesforce</h1>
        <p className="mt-8 text-pretty text-lg font-medium text-gray-400 sm:text-xl/8">
          Streamline Salesforce management and speed up your day-to-day workflow with Jetstream.
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <Link
            href={ROUTES.AUTH.signup}
            className="py-3 px-4 rounded-md shadow-sm bg-linear-to-r from-teal-500 to-cyan-600 text-white font-medium hover:from-teal-600 hover:to-cyan-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-cyan-400 focus:ring-offset-gray-900"
          >
            Get started for free
          </Link>
        </div>
      </div>
    </div>
  </div>
);

export default HeaderCta;
