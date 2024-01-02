/* eslint-disable @next/next/no-img-element */
import FeatureHeading from './FeatureHeading';

export const FeatureScreenshot = () => (
  <div className="relative bg-gray-50 pt-16 sm:pt-24">
    <div className="mx-auto max-w-md px-4 text-center sm:px-6 sm:max-w-3xl lg:px-8 lg:max-w-7xl">
      <FeatureHeading
        title="Advanced tools"
        heading="Everything you need to get the job done."
        description="Jetstream was designed with speed and simplicity in mind and makes it easy to quickly perform the tasks you need to get done."
      />
      <div className="mt-12 -mb-10 sm:-mb-24 lg:-mb-80">
        <img
          className="rounded-lg shadow-xl ring-1 ring-black ring-opacity-5"
          src="https://res.cloudinary.com/getjetstream/image/upload/v1634601910/public/website/jetstream-app-landing-page.png"
          alt=""
        />
      </div>
    </div>
  </div>
);

export default FeatureScreenshot;
