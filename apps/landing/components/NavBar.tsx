import React from 'react';
import Logo from './Logo';

export const NavBar = () => (
  <nav className="relative flex flex-col sm:flex-row items-center justify-between sm:h-10 lg:justify-between">
    <div className="flex items-center flex-grow flex-shrink-0 lg:flex-grow-0">
      <Logo />
    </div>
    <div className="md:ml-10 md:pr-4">
      <a
        href="/oauth/login"
        className="inline-flex items-center px-4 py-2 border border-blue-600 text-sm leading-5 font-medium rounded-md text-blue-600 hover:text-blue-700 focus:outline-none focus:ring-blue focus:border-blue-300 active:text-blue-800 active:bg-cool-gray-50 transition duration-150 ease-in-out"
      >
        Log in
      </a>
      <a
        href="/oauth/signup"
        className="mt-4 ml-3 w-full p-2 border border-transparent text-base leading-6 font-medium rounded-md text-white bg-blue-600 shadow-sm hover:bg-blue-700 focus:outline-none focus:ring active:bg-blue-800 transition duration-150 ease-in-out"
      >
        Sign Up
      </a>
    </div>
  </nav>
);

export default NavBar;
