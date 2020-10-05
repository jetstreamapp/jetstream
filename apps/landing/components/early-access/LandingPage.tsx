import React from 'react';
import CallToActionFooter from './CallToActionFooter';
import CallToActionHeader from './CallToActionHeader';
import Faq from './FAQ';
import SplitBrandPricing from './SplitBrandPricing';

export const LandingPage = () => (
  <div>
    <CallToActionHeader />
    <SplitBrandPricing />
    <Faq />
    <CallToActionFooter />
  </div>
);

export default LandingPage;
