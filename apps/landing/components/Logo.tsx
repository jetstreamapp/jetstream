import React from 'react';
import logo from '../assets/images/jetstream-logo-v1-200w.png';

export const Logo = () => (
  <div className="flex items-center justify-between w-full md:w-auto">
    <a href="/">
      <img className="h-8 w-auto sm:h-10" src={logo} alt="" />
    </a>
  </div>
);

export default Logo;
