import React from 'react';
import FeatureGrid from './FeatureGrid';
import FeatureScreenshot from './FeatureScreenshot';
import HeaderCta from './HeaderCta';
import SupportCta from './SupportCta';

export const LandingPage = () => (
  <main>
    <HeaderCta />
    <FeatureScreenshot />
    <FeatureGrid />
    {/* TODO: get testimonial - this only looks good if <Learn> section is also included */}
    {/* <Testimonial /> */}
    {/* TODO: add links to something */}
    {/* <Learn /> */}
    <SupportCta />
  </main>
);

export default LandingPage;
