import React from 'react';
import logo from '../assets/images/jetstream-logo-v1-200w.png';

export const NavBar = () => (
  <nav className="relative flex items-center justify-between sm:h-10 lg:justify-between">
    <div className="flex items-center flex-grow flex-shrink-0 lg:flex-grow-0">
      <div className="flex items-center justify-between w-full md:w-auto">
        <a href="/">
          <img className="h-8 w-auto sm:h-10" src={logo} alt="" />
        </a>
      </div>
    </div>
    <div className="block md:ml-10 md:pr-4">
      <a
        href="/app"
        className="font-medium text-blue-600 hover:text-blue-900 focus:outline-none focus:text-blue-700 transition duration-150 ease-in-out"
      >
        Log in
      </a>
    </div>
  </nav>
);

export default NavBar;
