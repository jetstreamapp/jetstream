import { useUserProfile } from '../../hooks/auth.hooks';
import Footer, { FooterProps } from '../Footer';
import HeaderNoNavigation from '../HeaderNoNavigation';
import Navigation, { NavigationProps } from '../Navigation';
import LayoutHead from './LayoutHead';

export default function Layout({
  title,
  isInverse,
  navigationProps,
  footerProps,
  omitNavigation,
  omitFooter,
  userHeaderWithoutNavigation,
  children,
}: {
  title?: string;
  isInverse?: boolean;
  navigationProps?: Omit<NavigationProps, 'userProfile'>;
  footerProps?: FooterProps;
  omitNavigation?: boolean;
  omitFooter?: boolean;
  userHeaderWithoutNavigation?: boolean;
  children: React.ReactNode;
}) {
  const userProfile = useUserProfile();

  return (
    <div>
      <LayoutHead title={title} />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:rounded focus:shadow"
      >
        Skip to main content
      </a>
      <div className={isInverse ? 'bg-white' : undefined}>
        <div className={isInverse ? 'relative overflow-hidden' : undefined}>
          {!omitNavigation && !userHeaderWithoutNavigation && (
            <Navigation inverse={isInverse} {...navigationProps} userProfile={userProfile} />
          )}
          {userHeaderWithoutNavigation && <HeaderNoNavigation />}
          {/* Skip-link target only — several pages render their own <main> landmark, so this must stay a plain div */}
          <div id="main-content" tabIndex={-1} className="outline-none">
            {children}
          </div>
          {!omitFooter && <Footer {...footerProps} />}
        </div>
      </div>
    </div>
  );
}
