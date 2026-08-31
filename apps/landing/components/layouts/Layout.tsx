import { useUserProfile } from '../../hooks/auth.hooks';
import Footer, { FooterProps } from '../Footer';
import HeaderNoNavigation from '../HeaderNoNavigation';
import Navigation, { NavigationProps } from '../Navigation';
import LayoutHead from './LayoutHead';

const MAIN_CONTENT_ID = 'main-content';

/**
 * The skip link's target is only focusable while the skip link hands it focus (the same approach as
 * `focusContainer` in @jetstream/ui, which the landing site does not depend on). A permanent tabIndex
 * would make every click on page text focus the wrapper, so Tab would restart from the top of the page.
 */
function focusMainContent() {
  const mainContent = document.getElementById(MAIN_CONTENT_ID);
  if (!mainContent) {
    return;
  }
  mainContent.setAttribute('tabindex', '-1');
  mainContent.focus();
  const release = () => {
    mainContent.removeAttribute('tabindex');
    mainContent.removeEventListener('blur', release);
    mainContent.removeEventListener('pointerdown', release, { capture: true });
  };
  mainContent.addEventListener('blur', release);
  mainContent.addEventListener('pointerdown', release, { capture: true });
}

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
        href={`#${MAIN_CONTENT_ID}`}
        onClick={focusMainContent}
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
          <div id={MAIN_CONTENT_ID} className="outline-none">
            {children}
          </div>
          {!omitFooter && <Footer {...footerProps} />}
        </div>
      </div>
    </div>
  );
}
