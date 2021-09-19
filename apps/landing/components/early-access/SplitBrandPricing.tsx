import React from 'react';
import RecordLookupIcon from '../icons/RecordLookupIcon';
import StandardActivationsIcon from '../icons/StandardActivationsIcon';
import StandardAnnouncementIcon from '../icons/StandardAnnouncementIcon';
import StandardDataStreamsIcon from '../icons/StandardDataStreamsIcon';
import StandardPortalIcon from '../icons/StandardPortalIcon';
import FeatureWithIcon from './FeatureWithIcon';
import PricingTable from './PricingTable';

export const SplitBrandPricing = () => (
  <div className="relative bg-white">
    <div
      style={{
        zIndex: 100,
        opacity: 0.7,
        position: 'absolute',
        width: 100,
        height: 100,
        pointerEvents: 'none',
      }}
    ></div>
    <div className="absolute inset-0" aria-hidden="true">
      <div className="absolute inset-y-0 right-0 w-1/2 bg-blue-700" />
    </div>
    <div className="relative max-w-screen-xl mx-auto lg:grid lg:grid-cols-2 lg:px-8">
      <div className="bg-white py-16 px-4 sm:pt-8 sm:pb-24 sm:px-6 lg:px-0 lg:pr-8">
        <div className="max-w-lg mx-auto lg:mx-0">
          <h2 className="text-base leading-6 font-semibold tracking-wide text-blue-700 uppercase">Full-featured</h2>
          <p className="mt-2 text-2xl leading-8 font-extrabold text-gray-900 sm:text-3xl sm:leading-9">
            Everything you need to get your work done faster.
          </p>
          <dl className="mt-12 space-y-10">
            <FeatureWithIcon title="Query Records" icon={<RecordLookupIcon />} bgColorClass="bg-standard-record-lookup">
              Use the advanced query builder to quickly retrieve records or metadata and easily view information about fields and object
              relationships.
            </FeatureWithIcon>
            <FeatureWithIcon title="Load Records" icon={<StandardDataStreamsIcon />} bgColorClass="bg-standard-data-streams">
              Create or update records using our easy to use data loader. You can even disable automation, such as validation rules, before
              you load your data and enable them once the data load is finished.
            </FeatureWithIcon>
            <FeatureWithIcon title="Automation Control" icon={<StandardActivationsIcon />} bgColorClass="bg-standard-activations">
              Quickly toggle automation such as Workflow Rules, Validation Rules, Process Builders, Record Triggered Flows, and Apex
              Triggers in your org.
            </FeatureWithIcon>
            <FeatureWithIcon title="Manage Permissions" icon={<StandardPortalIcon />} bgColorClass="bg-standard-portal">
              Easily update object and field level security across many objects for multiple profiles or permission sets.
            </FeatureWithIcon>
            <FeatureWithIcon title="Coming Soon" icon={<StandardAnnouncementIcon />}>
              More features are being developed and will be released soon!
            </FeatureWithIcon>
          </dl>
        </div>
      </div>
      <PricingTable />
    </div>
  </div>
);

export default SplitBrandPricing;
