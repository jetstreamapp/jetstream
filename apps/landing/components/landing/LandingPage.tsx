import { AnalyticStat } from '@jetstream/types';
import AnalyticsSummary from './AnalyticsSummary';
import ConnectWithTeam from './ConnectWithTeam';
import FeatureGrid from './FeatureGrid';
import FeatureScreenshot from './FeatureScreenshot';
import HeaderCta from './HeaderCta';
import Learn from './Learn';
import SupportCta from './SupportCta';
import Testimonial from './Testimonial';

export const LandingPage = ({ stats }: { stats: AnalyticStat[] }) => (
  <main>
    <HeaderCta />
    <AnalyticsSummary stats={stats} />
    <ConnectWithTeam />
    <FeatureScreenshot />
    <FeatureGrid />
    <Testimonial />
    <Learn />
    <SupportCta />
  </main>
);

export default LandingPage;
