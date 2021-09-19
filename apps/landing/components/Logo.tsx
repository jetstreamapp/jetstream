import React from 'react';
// import logo from '../assets/images/jetstream-logo-v1-200w.png';
import Link from 'next/link';

export const Logo = ({ className }: { className?: string }) => (
  <div className={className || 'flex items-center justify-between w-auto mb-4 sm:mb-0'}>
    <Link href="/">
      {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
      <a>
        <img className="h-8 w-auto sm:h-10" src="/jetstream-logo-v1-200w.png" alt="Jetstream logo" />
      </a>
    </Link>
  </div>
);

export default Logo;
