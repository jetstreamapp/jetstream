import { AnalyticStat } from '@jetstream/types';
import AnalyticsSummary from './AnalyticsSummary';
import ConnectWithTeam from './ConnectWithTeam';
import FeatureGrid from './FeatureGrid';
import FeatureScreenshot from './FeatureScreenshot';
import FooterCta from './FooterCta';
import { HeaderCta } from './HeaderCta';
import Learn from './Learn';
import PersonaFeatures from './PersonaFeatures';
import Testimonial from './Testimonial';

export const LandingPage = ({ stats }: { stats?: AnalyticStat[] | null }) => (
  <div className="bg-gray-900">
    <main>
      <HeaderCta />
      <PersonaFeatures />
      {stats && stats.length > 0 && <AnalyticsSummary stats={stats} />}
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
