/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { Fragment } from 'react';
import { ErrorQueryParamErrorBanner } from '../ErrorQueryParamErrorBanner';

export function AuthPageLayout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Fragment>
      <ErrorQueryParamErrorBanner />
      <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-sm">
          <Link href="/">
            <img
              alt="Jetstream"
              src="https://res.cloudinary.com/getjetstream/image/upload/v1634516624/public/jetstream-logo.svg"
              className="mx-auto h-10 w-auto"
            />
          </Link>
          <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">{title}</h2>
        </div>
        <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">{children}</div>
      </div>
    </Fragment>
  );
}
