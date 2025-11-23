import Link from 'next/link';
import Layout from '../../components/layouts/Layout';
import { ROUTES } from '../../utils/environment';

const email = 'support@getjetstream.app';

export default function Page() {
  return (
    <main className="grow flex flex-col justify-center max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 sm:my-4 md:my-12">
      <div className="py-16">
        <div className="text-center">
          <p className="text-sm font-semibold text-cyan-600 uppercase tracking-wide">Goodbye</p>
          <h1 className="mt-2 text-4xl font-extrabold text-gray-900 tracking-tight sm:text-5xl">We're sorry to see you go!</h1>
          <p className="mt-2 text-base text-gray-500">We would love to have you back in the future!</p>
          <p className="mt-2 text-base text-gray-500">
            Don't hesitate to reach out to us via email at{' '}
            <a
              href="mailto:support@getjetstream.app"
              className="text-cyan-600 hover:text-cyan-500 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              {email}
            </a>{' '}
            if you have any questions or have feedback on what we can do better.
          </p>
          <div className="mt-6">
            <Link href={ROUTES.HOME} className="text-base font-medium text-cyan-600 hover:text-cyan-500">
              Go back home<span aria-hidden="true"> &rarr;</span>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

Page.getLayout = function getLayout(page) {
  return <Layout>{page}</Layout>;
};
