import ConnectWithTeam from './ConnectWithTeam';
import FeatureGrid from './FeatureGrid';
import FeatureScreenshot from './FeatureScreenshot';
import FooterCta from './FooterCta';
import { HeaderCta } from './HeaderCta';
import Learn from './Learn';
import PersonaFeatures from './PersonaFeatures';
import Testimonial from './Testimonial';

export const LandingPage = () => (
  <div className="bg-gray-900">
    <main>
      <HeaderCta />
      <PersonaFeatures />
      {/* Analytics tracking has been broken for some time - these numbers are not accurate */}
      {/* <AnalyticsSummary stats={stats} /> */}
      <ConnectWithTeam />
      <FeatureScreenshot />
      <FeatureGrid />
      <Testimonial />
      <Learn />
      <FooterCta />
    </main>
  </div>
);

export default LandingPage;
