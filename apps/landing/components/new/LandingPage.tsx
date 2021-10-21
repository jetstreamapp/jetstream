import React from 'react';
import FeatureGrid from './FeatureGrid';
import FeatureScreenshot from './FeatureScreenshot';
import HeaderCta from './HeaderCta';
import SupportCta from './SupportCta';
import Testimonial from './Testimonial';
import Learn from './Learn';

export const LandingPage = () => (
  <main>
    <HeaderCta />
    <FeatureScreenshot />
    <FeatureGrid />
    <Testimonial />
    <Learn />
    <SupportCta />
  </main>
);

export default LandingPage;
