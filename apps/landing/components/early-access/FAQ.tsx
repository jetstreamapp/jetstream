import React from 'react';
import FaqItem from './FaqItem';

export const Faq = () => (
  <div className="max-w-screen-xl mx-auto py-16 px-4 sm:py-24 sm:px-6 lg:px-8">
    <h2 className="text-3xl leading-9 font-extrabold text-gray-900 text-center">Frequently asked questions</h2>
    <div className="mt-12">
      <dl className="space-y-10 md:space-y-0 md:grid md:grid-cols-2 md:grid-rows-2 md:col-gap-8 md:row-gap-12 lg:grid-cols-3">
        <FaqItem
          title="How does Jetstream get access to my orgs data and metadata?"
          text="Jetstream uses a Salesforce Connected App to login without ever obtaining access to your Salesforce password."
        />
        <FaqItem
          title="What org data does Jetstream store in it's database?"
          text="Jetstream never stores any of your orgs record data or metadata outside of your browser."
        />
        <FaqItem
          title="How long will Jetstream be free?"
          text="We do not yet have an answer to this question, but we will communicate any changes in our pricing model well in advance of any changes being made."
        />
        <FaqItem
          title="What Salesforce permissions do I need?"
          text={`To make use of all of Jetstream's features, your Salesforce user should have one of the following permissions: "Customize Application", "Modify Metadata Through Metadata API Functions", or "Modify All Data".`}
        />
        <FaqItem
          title="Is Jetstream secure?"
          text="Yes! We take security very seriously and have designed Jetstream using industry standard security processes."
        />
        <FaqItem
          title="What do I need to do to enable access to my Salesforce org?"
          text={`Most orgs do not require any additional configuration, but you may need to have your Admin allow Jetstream on the "Connected Apps OAuth Usage page" if you have trouble connecting your org.`}
        />
      </dl>
    </div>
  </div>
);

export default Faq;
