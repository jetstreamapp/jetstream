import Link from 'next/link';
import { ROUTES } from '../../utils/environment';

export const FooterCta = () => (
  <div className="relative isolate px-6 py-32 sm:py-40 lg:px-8">
    <svg
      aria-hidden="true"
      className="absolute inset-0 -z-10 size-full stroke-white/10 mask-[radial-gradient(100%_100%_at_top_right,white,transparent)]"
    >
      <defs>
        <pattern x="50%" y={0} id="1d4240dd-898f-445f-932d-e2872fd12de3" width={200} height={200} patternUnits="userSpaceOnUse">
          <path d="M.5 200V.5H200" fill="none" />
        </pattern>
      </defs>
      <svg x="50%" y={0} className="overflow-visible fill-gray-800/20">
        <path d="M-200 0h201v201h-201Z M600 0h201v201h-201Z M-400 600h201v201h-201Z M200 800h201v201h-201Z" strokeWidth={0} />
      </svg>
      <rect fill="url(#1d4240dd-898f-445f-932d-e2872fd12de3)" width="100%" height="100%" strokeWidth={0} />
    </svg>
    <div aria-hidden="true" className="absolute inset-x-0 top-10 -z-10 flex transform-gpu justify-center overflow-hidden blur-3xl">
      <div
        style={{
          clipPath:
            'polygon(73.6% 51.7%, 91.7% 11.8%, 100% 46.4%, 97.4% 82.2%, 92.5% 84.9%, 75.7% 64%, 55.3% 47.5%, 46.5% 49.4%, 45% 62.9%, 50.3% 87.2%, 21.3% 64.1%, 0.1% 100%, 5.4% 51.1%, 21.4% 63.9%, 58.9% 0.2%, 73.6% 51.7%)',
        }}
        className="aspect-1108/632 w-277 flex-none bg-linear-to-r from-[#80caff] to-[#4f46e5] opacity-20"
      />
    </div>
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl">
        Boost your productivity. Start using Jetstream today.
      </h2>
      <p className="mx-auto mt-6 max-w-xl text-lg/8 text-gray-300">
        Become a Salesforce power user with Jetstream. Manage your data and metadata with ease and get more done in less time.
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
);

export default FooterCta;
