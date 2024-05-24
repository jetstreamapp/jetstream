/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';

const footerNavigation = {
  support: [
    { name: 'Documentation', href: 'https://docs.getjetstream.app/', target: '_blank' },
    { name: 'Ask a question', href: 'https://discord.gg/sfxd', target: '_blank' },
    { name: 'File an issue', href: 'https://github.com/jetstreamapp/jetstream/issues', target: '_blank' },
    { name: 'Contact Us', href: 'mailto:support@getjetstream.app', target: '_blank' },
  ],
  company: [
    { name: 'About', href: '/about' },
    { name: 'Blog', href: '/blog' },
  ],
  legal: [
    { name: 'Privacy & Security', href: '/privacy' },
    { name: 'Terms of Service', href: '/terms-of-service' },
    { name: 'Data Sub-Processors', href: '/subprocessors' },
  ],
};

export const Footer = ({ omitLinks = [] }: { omitLinks?: string[] }) => (
  <footer className="bg-gray-50" aria-labelledby="footer-heading">
    <h2 id="footer-heading" className="sr-only">
      Footer
    </h2>
    <div className="max-w-md mx-auto pt-12 px-4 sm:max-w-7xl sm:px-6 lg:pt-16 lg:px-8">
      <div className="xl:grid xl:grid-cols-3 xl:gap-8">
        <div className="space-y-8 xl:col-span-1">
          <Link href="/">
            <img
              className="h-12"
              src="https://res.cloudinary.com/getjetstream/image/upload/v1634516624/public/jetstream-logo.svg"
              alt="Jetstream"
            />
          </Link>
          <p className="text-gray-500 text-base">Providing tools to help you get your job done faster.</p>
        </div>
        <div className="mt-12 grid grid-cols-3 gap-8 xl:mt-0 xl:col-span-2">
          <div className="md:grid md:grid-cols-1 md:gap-8">
            <div className="mt-12 md:mt-0">
              <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">Support</h3>
              <ul className="mt-4 space-y-4">
                {footerNavigation.support
                  .filter((item) => !omitLinks.includes(item.href))
                  .map((item) => (
                    <li key={item.name}>
                      {item.target && (
                        <a href={item.href} className="text-base text-gray-500 hover:text-gray-900" target={item.target}>
                          {item.name}
                        </a>
                      )}
                      {!item.target && (
                        <Link href={item.href} className="text-base text-gray-500 hover:text-gray-900">
                          {item.name}
                        </Link>
                      )}
                    </li>
                  ))}
              </ul>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">Company</h3>
            <ul className="mt-4 space-y-4">
              {footerNavigation.company
                .filter((item) => !omitLinks.includes(item.href))
                .map((item) => (
                  <li key={item.name}>
                    <a href={item.href} className="text-base text-gray-500 hover:text-gray-900">
                      {item.name}
                    </a>
                  </li>
                ))}
            </ul>
          </div>
          <div className="mt-12 md:mt-0">
            <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">Legal</h3>
            <ul className="mt-4 space-y-4">
              {footerNavigation.legal
                .filter((item) => !omitLinks.includes(item.href))
                .map((item) => (
                  <li key={item.name}>
                    <Link href={item.href} className="text-base text-gray-500 hover:text-gray-900">
                      {item.name}
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      </div>
      <div className="mt-12 border-t border-gray-200 py-8">
        <p className="text-base text-gray-400 xl:text-center">&copy; {new Date().getFullYear()} Jetstream. All rights reserved.</p>
      </div>
    </div>
  </footer>
);

export default Footer;
