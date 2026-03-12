import { FeatureShowcase } from './FeatureShowcase';
import { FooterCta } from './FooterCta';
import { HeroSection } from './HeroSection';
import { PlatformSection } from './PlatformSection';
import { PricingPreview } from './PricingPreview';
import { ValueProposition } from './ValueProposition';

export const LandingPage = () => (
  <main className="relative isolate overflow-hidden bg-gray-900">
    {/* Gradient blur blob — drifts across the page */}
    <div
      aria-hidden="true"
      className="absolute left-[calc(50%-4rem)] top-[15%] -z-10 transform-gpu blur-3xl sm:left-[calc(50%-18rem)] lg:left-48 xl:left-[calc(50%-24rem)]"
    >
      <div
        style={{
          clipPath:
            'polygon(73.6% 51.7%, 91.7% 11.8%, 100% 46.4%, 97.4% 82.2%, 92.5% 84.9%, 75.7% 64%, 55.3% 47.5%, 46.5% 49.4%, 45% 62.9%, 50.3% 87.2%, 21.3% 64.1%, 0.1% 100%, 5.4% 51.1%, 21.4% 63.9%, 58.9% 0.2%, 73.6% 51.7%)',
        }}
        className="aspect-1108/632 w-277 bg-linear-to-r from-[#80caff] to-[#4f46e5] opacity-20"
      />
    </div>

    <HeroSection />
    <ValueProposition />
    <FeatureShowcase />
    <PlatformSection />
    <PricingPreview />
    <FooterCta />
  </main>
);

export default LandingPage;
