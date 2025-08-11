import {
  FloatingFocusManager,
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
  useTransitionStyles,
} from '@floating-ui/react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/20/solid';
import classNames from 'classnames';
import Link from 'next/link';
import { useState } from 'react';
import { useUserProfile } from '../hooks/auth.hooks';
import { ENVIRONMENT, ROUTES } from '../utils/environment';

const navigation = [
  { name: 'Features', href: '/#features' },
  { name: 'Documentation', href: 'https://docs.getjetstream.app/', target: '_blank' },
  { name: 'Pricing', href: '/pricing', disabled: !ENVIRONMENT.BILLING_ENABLED },
  { name: 'Privacy & Security', href: '/privacy' },
  { name: 'Blog', href: '/blog' },
];

export interface NavigationProps {
  className?: string;
  inverse?: boolean;
  omitLinks?: string[];
  userProfile?: ReturnType<typeof useUserProfile>;
}

export const Navigation = ({ className, inverse, omitLinks = [], userProfile }: NavigationProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: 'bottom-end',
    middleware: [offset(8), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const dismiss = useDismiss(context, {
    outsidePress: true,
  });
  const role = useRole(context, { role: 'menu' });

  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss, role]);

  const { isMounted, styles: transitionStyles } = useTransitionStyles(context, {
    duration: {
      open: 150,
      close: 100,
    },
    initial: {
      opacity: 0,
      transform: 'scale(0.95)',
    },
    open: {
      opacity: 1,
      transform: 'scale(1)',
    },
    close: {
      opacity: 0,
      transform: 'scale(0.95)',
    },
  });

  return (
    <header className={classNames(className, 'relative')}>
      <div className={classNames('py-6', { 'bg-gray-900': inverse, 'bg-white': !inverse })}>
        <nav className="relative max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6" aria-label="Global">
          <div className="flex items-center flex-1">
            <div className="flex items-center justify-between w-full md:w-auto">
              <Link href={ROUTES.HOME}>
                <span className="sr-only">Jetstream</span>
                <img
                  className="h-8 w-auto sm:h-10"
                  src={
                    inverse
                      ? 'https://res.cloudinary.com/getjetstream/image/upload/v1634516624/public/jetstream-logo-inverse.svg'
                      : 'https://res.cloudinary.com/getjetstream/image/upload/v1634516624/public/jetstream-logo.svg'
                  }
                  alt="Jetstream logo"
                />
              </Link>
              <div className="-mr-2 flex items-center md:hidden">
                <button
                  ref={refs.setReference}
                  {...getReferenceProps()}
                  className={classNames(
                    'rounded-md p-2 inline-flex items-center justify-center focus:outline-none focus:ring-2 focus-ring-inset focus:ring-white',
                    {
                      'text-gray-400 hover:bg-gray-800 bg-gray-900': inverse,
                      'bg-white  text-gray-400 hover:text-gray-500 hover:bg-gray-100': !inverse,
                    }
                  )}
                  onClick={() => setIsOpen(!isOpen)}
                >
                  <span className="sr-only">Open main menu</span>
                  <Bars3Icon className="h-6 w-6" aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="hidden space-x-8 md:flex md:ml-10">
              {navigation
                .filter((item) => !omitLinks.includes(item.href) && !item.disabled)
                .map((item) => (
                  <a
                    key={item.name}
                    href={item.href}
                    className={classNames('text-base font-medium', {
                      'text-white hover:text-gray-300': inverse,
                      'text-gray-500 hover:text-gray-900': !inverse,
                    })}
                    target={item.target}
                  >
                    {item.name}
                  </a>
                ))}
              <a href="https://github.com/jetstreamapp/jetstream" target="_blank" rel="noreferrer">
                <img
                  title="View project on Github"
                  className="h-6 w-6"
                  src="https://res.cloudinary.com/getjetstream/image/upload/v1673824284/public/github-mark-white_ksnuo6.svg"
                  alt="View project on Github"
                />
              </a>
              <a href="https://discord.gg/sfxd" target="_blank" rel="noreferrer">
                <img
                  title="Join the SFXD Discord Community (#vendors-jetstream)"
                  className="h-6 w-6"
                  src="https://res.cloudinary.com/getjetstream/image/upload/v1673824421/public/discord-mark-white_ny5zwv.svg"
                  alt="Join the SFXD Discord Community (#vendors-jetstream)"
                />
              </a>
            </div>
          </div>
          <div className="hidden md:flex md:items-center md:space-x-6">
            {userProfile?.isLoggedIn && !userProfile?.pendingVerifications ? (
              <>
                <a
                  href={ENVIRONMENT.CLIENT_URL}
                  className={classNames('inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md', {
                    'text-white bg-gray-600 hover:bg-gray-700': inverse,
                    'bg-gradient-to-r from-teal-500 to-cyan-600 text-white font-medium hover:from-teal-600 hover:to-cyan-700': !inverse,
                  })}
                >
                  Go to Jetstream
                </a>
              </>
            ) : (
              <>
                {' '}
                <Link
                  href={ROUTES.AUTH.login}
                  className={classNames('text-base font-medium', {
                    'text-white hover:text-gray-300': inverse,
                    'text-gray-500 hover:text-gray-900': !inverse,
                  })}
                >
                  Log in
                </Link>
                <Link
                  href={ROUTES.AUTH.signup}
                  className={classNames('inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md', {
                    'text-white bg-gray-600 hover:bg-gray-700': inverse,
                    'bg-gradient-to-r from-teal-500 to-cyan-600 text-white font-medium hover:from-teal-600 hover:to-cyan-700': !inverse,
                  })}
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </nav>
      </div>

      {isMounted && (
        <FloatingPortal>
          <FloatingFocusManager context={context} modal={false} returnFocus={false}>
            <div
              ref={refs.setFloating}
              style={{ ...floatingStyles, ...transitionStyles }}
              {...getFloatingProps()}
              className="absolute top-0 inset-x-0 p-2 transition transform origin-top md:hidden"
            >
              <div className="rounded-lg shadow-md bg-white ring-1 ring-black ring-opacity-5 overflow-hidden">
                <div className="px-5 pt-4 flex items-center justify-between">
                  <div>
                    <img
                      className="h-8 w-auto"
                      src="https://res.cloudinary.com/getjetstream/image/upload/v1634608986/public/jetstream-icon-bare.svg"
                      alt="Jetstream logo"
                    />
                  </div>
                  <div className="-mr-2">
                    <button
                      className="bg-white rounded-md p-2 inline-flex items-center justify-center text-gray-400 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-cyan-600"
                      onClick={() => setIsOpen(false)}
                    >
                      <span className="sr-only">Close menu</span>
                      <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <div className="pt-5 pb-6">
                  <div className="px-2 space-y-1">
                    {navigation
                      .filter((item) => !omitLinks.includes(item.href))
                      .map((item) => (
                        <Link
                          key={item.name}
                          href={item.href}
                          className="block px-3 py-2 rounded-md text-base font-medium text-gray-900 hover:bg-gray-50"
                        >
                          {item.name}
                        </Link>
                      ))}
                    <a
                      href="https://github.com/jetstreamapp/jetstream"
                      target="_blank"
                      rel="noreferrer"
                      className="flex px-3 py-2 rounded-md text-base font-medium text-gray-900 hover:bg-gray-50"
                    >
                      Github Project
                    </a>
                    <a
                      href="https://discord.gg/sfxd"
                      target="_blank"
                      rel="noreferrer"
                      className="flex px-3 py-2 rounded-md text-base font-medium text-gray-900 hover:bg-gray-50"
                    >
                      SFXD Discord <span className="ml-2 text-gray-400">(#vendors-jetstream)</span>
                    </a>
                  </div>
                  <div className="mt-6 px-5">
                    <Link
                      href={ROUTES.AUTH.signup}
                      className="block text-center w-full py-3 px-4 rounded-md shadow bg-gradient-to-r from-teal-500 to-cyan-600 text-white font-medium hover:from-teal-600 hover:to-cyan-700"
                    >
                      Sign up for free
                    </Link>
                  </div>
                  <div className="mt-6 px-5">
                    <p className="text-center text-base font-medium text-gray-500">
                      Existing customer?{' '}
                      <Link href={ROUTES.AUTH.login} className="text-gray-900 hover:underline">
                        Login
                      </Link>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </header>
  );
};

export default Navigation;
