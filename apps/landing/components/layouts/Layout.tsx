import { useUserProfile } from '../../hooks/auth.hooks';
import Footer, { FooterProps } from '../Footer';
import HeaderNoNavigation from '../HeaderNoNavigation';
import Navigation, { NavigationProps } from '../Navigation';
import LayoutHead, { LayoutHeadProps } from './LayoutHead';

export default function Layout({
  title,
  description,
  structuredData,
  isInverse,
  navigationProps,
  footerProps,
  omitNavigation,
  omitFooter,
  userHeaderWithoutNavigation,
  children,
}: Pick<LayoutHeadProps, 'title' | 'description' | 'structuredData'> & {
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
      <LayoutHead title={title} description={description} structuredData={structuredData} />
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
