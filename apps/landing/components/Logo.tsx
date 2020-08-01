import React from 'react';
import logo from '../assets/images/jetstream-logo-v1-200w.png';
import Link from 'next/link';

export const Logo = () => (
  <div className="flex items-center justify-between w-full md:w-auto">
    <Link href="/">
      {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
      <a>
        <img className="h-8 w-auto sm:h-10" src={logo} alt="" />
      </a>
    </Link>
  </div>
);

export default Logo;
