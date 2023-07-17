/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';

export const HeaderNoNavigation = () => (
  <div className="py-6 bg-white">
    <nav className="relative max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6" aria-label="Global">
      <div className="flex items-center flex-1">
        <div className="flex items-center justify-between w-full md:w-auto">
          <Link href="/">
            <span className="sr-only">Jetstream</span>
            <img
              className="h-8 w-auto sm:h-10"
              src="https://res.cloudinary.com/getjetstream/image/upload/v1634516624/public/jetstream-logo.svg"
              alt="Jetstream logo"
            />
          </Link>
        </div>
      </div>
    </nav>
  </div>
);

export default HeaderNoNavigation;
