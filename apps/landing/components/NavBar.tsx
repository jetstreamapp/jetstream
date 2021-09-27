/* eslint-disable jsx-a11y/anchor-is-valid */
import React, { useState } from 'react';
import Logo from './Logo';
import LogoIcon from './LogoIcon';
import Link from 'next/link';
import classNames from 'classnames';

interface NavBarProps {
  currPage: 'home' | 'blog' | 'about' | 'tos' | 'privacy';
  omitBlogPosts?: boolean;
}

function MenuIcon({ className }: { className: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function MenuXIcon({ className }: { className: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export function NavBar({ currPage, omitBlogPosts }: NavBarProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="-ml-2 mr-2 flex items-center md:hidden">
              {/* mobile menu button */}
              <button
                type="button"
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
                aria-controls="mobile-menu"
                aria-expanded="false"
                onClick={() => setIsOpen(!isOpen)}
              >
                <span className="sr-only">Open main menu</span>
                {/* icon when menu is closed */}
                <MenuIcon className="block h-6 w-6" />
                {/* icon when menu is open */}
                <MenuXIcon className="hidden h-6 w-6" />
              </button>
            </div>

            <div className="flex-shrink-0 flex items-center">
              <LogoIcon className="block md:hidden h-8 w-auto" />
              <Logo className="hidden md:block h-8 w-auto" />
            </div>
            <div className="hidden md:ml-6 md:flex md:space-x-8">
              <a
                className={classNames('inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium', {
                  'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700': currPage !== 'blog',
                  'border-gray-500 text-gray-900': currPage === 'blog',
                })}
                href="https://docs.getjetstream.app"
                target="_blank"
              >
                Documentation
              </a>
            </div>
            {!omitBlogPosts && (
              <div className="hidden md:ml-6 md:flex md:space-x-8">
                <Link href="/blog">
                  <a
                    className={classNames('inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium', {
                      'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700': currPage !== 'blog',
                      'border-gray-500 text-gray-900': currPage === 'blog',
                    })}
                  >
                    Blog
                  </a>
                </Link>
              </div>
            )}

            <div className="hidden md:ml-6 md:flex md:space-x-8">
              <a
                className={classNames(
                  'inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium',
                  'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                )}
                href="mailto:support@getjetstream.app"
                target="_blank"
                rel="noreferrer"
              >
                Contact Us
              </a>
            </div>
          </div>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <a
                href="/oauth/login"
                className="relative inline-flex items-center px-4 py-2 border border-blue-600 text-sm leading-5 font-medium rounded-md text-blue-600 hover:text-blue-700 focus:outline-none focus:ring-blue focus:border-blue-300 active:text-blue-800 active:bg-cool-gray-50 transition duration-150 ease-in-out"
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
          </div>
        </div>
      </div>

      {/* MOBILE - show hide based on state */}
      {isOpen && (
        <div className="md:hidden" id="mobile-menu">
          <div className="pt-2 pb-3 space-y-1">
            <a
              className={classNames(
                'block pl-3 pr-4 py-2 border-l-4 text-base font-medium sm:pl-5 sm:pr-6 border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              )}
              href="https://docs.getjetstream.app"
              target="_blank"
            >
              Documentation
            </a>
            {!omitBlogPosts && (
              <Link href="/blog">
                <a
                  className={classNames('block pl-3 pr-4 py-2 border-l-4 text-base font-medium sm:pl-5 sm:pr-6', {
                    'border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-900': currPage !== 'blog',
                    'bg-gray-50 border-gray-500 text-gray-900': currPage === 'blog',
                  })}
                >
                  Blog
                </a>
              </Link>
            )}
            <a
              className={classNames(
                'block pl-3 pr-4 py-2 border-l-4 text-base font-medium sm:pl-5 sm:pr-6 border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              )}
              href="mailto:support@getjetstream.app"
              target="_blank"
              rel="noreferrer"
            >
              Contact Us
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}

export default NavBar;
