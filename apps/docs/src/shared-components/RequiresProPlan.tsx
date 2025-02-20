import { JetstreamProLogo } from './JetstreamProLogo';

export const RequiresProPlan = () => {
  return (
    <>
      <JetstreamProLogo width="250px" />
      <p>
        This feature is only available on the Pro plan.{' '}
        <a href="https://getjetstream.app/pricing/" target="_blank" rel="noopener noreferrer">
          Upgrade to Pro
        </a>
        .
      </p>
    </>
  );
};

export default RequiresProPlan;
