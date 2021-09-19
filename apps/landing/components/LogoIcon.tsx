import React from 'react';
// import logo from '../assets/images/jetstream-icon.png';
import Link from 'next/link';

export const LogoIcon = ({ className }: { className?: string }) => (
  <div className={className || 'flex items-center justify-between w-auto mb-4 sm:mb-0'}>
    <Link href="/">
      {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
      <a>
        <img className="h-8 w-auto sm:h-10" src="/images/jetstream-icon.png" alt="Jetstream logo" />
      </a>
    </Link>
  </div>
);

export default LogoIcon;
