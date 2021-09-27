import React from 'react';
import Link from 'next/link';

interface FooterProps {
  currPage: 'home' | 'blog' | 'about' | 'tos' | 'privacy';
  omitBlogPosts?: boolean;
}

function getLink(path: string, label: string, isActive: boolean) {
  return (
    <div className="px-5 py-2 text-center sm:text-left">
      {!isActive && (
        <Link href={path}>
          {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
          <a className="text-base leading-6 text-gray-500 hover:text-gray-900">{label}</a>
        </Link>
      )}
      {isActive && <span className="text-base leading-6 text-gray-900">{label}</span>}
    </div>
  );
}

export const Footer = ({ currPage, omitBlogPosts }: FooterProps) => (
  <div className="">
    <div className="max-w-screen-xl mx-auto py-12 px-4 overflow-hidden sm:px-6 lg:px-8">
      <nav className="-mx-5 -my-2 flex flex-wrap justify-center flex-col sm:flex-row">
        {getLink('/', 'Home', currPage === 'home')}
        <div className="px-5 py-2 text-center sm:text-left">
          <a href="https://docs.getjetstream.app" target="_blank" className="text-base leading-6 text-gray-500 hover:text-gray-900">
            Documentation
          </a>
        </div>
        {!omitBlogPosts && getLink('/blog', 'Blog', currPage === 'blog')}
        {getLink('/terms-of-service', 'Terms of Service', currPage === 'tos')}
        {getLink('/privacy', 'Privacy Policy', currPage === 'privacy')}
        <div className="px-5 py-2 text-center sm:text-left">
          <a
            href="mailto:support@getjetstream.app"
            target="_blank"
            rel="noreferrer"
            className="text-base leading-6 text-gray-500 hover:text-gray-900"
          >
            Contact Us
          </a>
        </div>
      </nav>
      <div className="mt-8">
        <p className="text-center text-base leading-6 text-gray-400">&copy; 2020 Jetstream, LLC. All rights reserved.</p>
      </div>
    </div>
  </div>
);

export default Footer;
