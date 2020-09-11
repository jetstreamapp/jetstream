import React from 'react';
import Logo from './Logo';

export const NavBar = () => (
  <nav className="relative flex items-center justify-between sm:h-10 lg:justify-between">
    <div className="flex items-center flex-grow flex-shrink-0 lg:flex-grow-0">
      <Logo />
    </div>
    <div className="block md:ml-10 md:pr-4">
      <a
        href="/oauth/login"
        className="mt-4 w-full p-2 border border-transparent text-base leading-6 font-medium rounded-md text-white bg-blue-600 shadow-sm hover:bg-blue-700 focus:outline-none focus:shadow-outline active:bg-blue-800 transition duration-150 ease-in-out"
      >
        Log in
      </a>
    </div>
  </nav>
);

export default NavBar;
