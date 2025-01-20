import Link from 'next/link';
import Layout from '../components/layouts/Layout';
import { ROUTES } from '../utils/environment';

export default function Page() {
  return (
    <main className="flex-grow flex flex-col justify-center max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 sm:my-4 md:my-12">
      <div className="py-16">
        <div className="text-center">
          <p className="text-sm font-semibold text-cyan-600 uppercase tracking-wide">404 ERROR</p>
          <h1 className="mt-2 text-4xl font-extrabold text-gray-900 tracking-tight sm:text-5xl">Page not found</h1>
          <p className="mt-2 text-base text-gray-500">Sorry, we couldn't find the page you were looking for.</p>
          <div className="mt-6">
            <Link href={ROUTES.HOME} className="text-base font-medium text-cyan-600 hover:text-cyan-500">
              Go home<span aria-hidden="true"> &rarr;</span>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

Page.getLayout = function getLayout(page) {
  return <Layout title="Not Found | Jetstream">{page}</Layout>;
};
