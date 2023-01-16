import React, { Fragment, ReactNode } from 'react';
import RecordLookupIcon from '../icons/RecordLookupIcon';
import StandardActivationsIcon from '../icons/StandardActivationsIcon';
import StandardApexIcon from '../icons/StandardApexIcon';
import StandardAssetRelationshipIcon from '../icons/StandardAssetRelationshipIcon';
import StandardDataStreamsIcon from '../icons/StandardDataStreamsIcon';
import StandardPortalIcon from '../icons/StandardPortalIcon';
import FeatureHeading from './FeatureHeading';

const features: {
  name: string;
  descriptionHeading: string;
  description: ReactNode;
  icon: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
}[] = [
  {
    name: 'Query Records',
    descriptionHeading: 'Explore the records in your org.',
    description: (
      <p>
        Use the <strong>most advanced query builder</strong> to easily explore your data model and quickly find the records you are looking
        for.
      </p>
    ),
    icon: RecordLookupIcon,
  },
  {
    name: 'Load Records',
    descriptionHeading: 'Easily make changes to your record data.',
    description: (
      <span>
        <p>
          Jetstream has a <strong>simple and powerful data loader</strong> without any usage limits.
        </p>
        <p className="pt-2">
          You can even <strong>load related data to multiple objects</strong> at the same time.
        </p>
        <p className="pt-2">Say goodbye to using complicated VLOOKUPS in Excel to load related data into Salesforce.</p>
      </span>
    ),
    icon: StandardDataStreamsIcon,
  },
  {
    name: 'Automation Control',
    descriptionHeading: 'Review and toggle automation in your org.',
    description: (
      <Fragment>
        <p>
          Use Jetstream's Automation Control to <strong>view and toggle automation</strong> in your org.
        </p>
        <p className="pt-2">Use this if you need to temporarily disable automation prior to a data load.</p>
      </Fragment>
    ),
    icon: StandardActivationsIcon,
  },
  {
    name: 'Permission Manager',
    descriptionHeading: 'Update field and object permissions.',
    description: (
      <p>
        Easily <strong>view and toggle field and object permissions across many objects</strong> for multiple profiles and permission sets
        at once.
      </p>
    ),
    icon: StandardPortalIcon,
  },
  {
    name: 'Metadata Tools',
    descriptionHeading: 'Work with your orgs metadata.',
    description: (
      <ul className="list-disc text-left">
        <li>
          <strong>Deploy metadata</strong> between orgs.
        </li>
        <li>
          <strong>Compare metadata</strong> between orgs.
        </li>
        <li>
          <strong>Add metadata</strong> to an outbound changeset.
        </li>
        <li>
          <strong>Download metadata</strong> locally as a backup or make changes and re-deploy.
        </li>
      </ul>
    ),
    icon: StandardAssetRelationshipIcon,
  },
  {
    name: 'Developer Tools',
    descriptionHeading: 'Replace the Developer Console with Jetstream.',
    description: (
      <ul className="list-disc text-left">
        <li>
          Easily execute <strong>anonymous Apex</strong>.
        </li>
        <li>
          View <strong>debug logs</strong> from your org.
        </li>
        <li>
          Submit API requests using the <strong>Salesforce API</strong>.
        </li>
        <li>
          Subscribe to and publish <strong>Platform Events</strong>.
        </li>
      </ul>
    ),
    icon: StandardApexIcon,
  },
];

export const FeatureGrid = () => (
  <div id="features" className="relative bg-white py-16 pt-16 sm:pt-24">
    <div className="mx-auto max-w-md px-4 text-center sm:max-w-3xl sm:px-6 lg:px-8 lg:max-w-7xl">
      <FeatureHeading
        title="Unlimited org connections"
        heading="Lots of Salesforce orgs? No problem."
        description="Jetstream lets you connect as many Salesforce orgs as you want, providing a fast and secure way to switch between orgs."
      />
      <div className="mt-12">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.name} className="pt-6">
              <div className="flow-root bg-gray-50 rounded-lg px-6 pb-8 h-full">
                <div className="-mt-6">
                  <div>
                    {/* TODO: this is icon container class */}
                    <span className="inline-flex items-center justify-center p-2 bg-gradient-to-r from-teal-500 to-cyan-600 rounded-md shadow-lg">
                      <feature.icon className="h-12 w-12 text-white" aria-hidden="true" />
                    </span>
                  </div>
                  <h3 className="mt-8 text-lg font-medium text-gray-900 font-bold tracking-tight">{feature.name}</h3>
                  <div className="">{feature.descriptionHeading}</div>
                  <div className="text-left  mt-5 text-base text-gray-500">{feature.description}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default FeatureGrid;
