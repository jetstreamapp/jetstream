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
      <div className={isInverse ? 'bg-white' : undefined}>
        <div className={isInverse ? 'relative overflow-hidden' : undefined}>
          {!omitNavigation && !userHeaderWithoutNavigation && (
            <Navigation inverse={isInverse} {...navigationProps} userProfile={userProfile} />
          )}
          {userHeaderWithoutNavigation && <HeaderNoNavigation />}
          {children}
          {!omitFooter && <Footer {...footerProps} />}
        </div>
      </div>
    </div>
  );
}
