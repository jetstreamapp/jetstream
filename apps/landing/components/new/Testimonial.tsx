import React from 'react';

/**
 * TODO:
 */
export const Testimonial = () => (
  <div className="pb-16 bg-gradient-to-r from-teal-500 to-cyan-600 lg:pb-0 lg:z-10 lg:relative">
    <div className="lg:mx-auto lg:max-w-7xl lg:px-12 lg:grid lg:grid-cols-3 lg:gap-8">
      <div className="lg:m-0 lg:col-span-3 lg:pl-8">
        <div className="mx-auto max-w-md px-4 sm:max-w-2xl sm:px-6 lg:px-0 lg:py-16 lg:max-w-none">
          <blockquote>
            <div>
              <svg className="h-12 w-12 text-white opacity-25" fill="currentColor" viewBox="0 0 32 32" aria-hidden="true">
                <path d="M9.352 4C4.456 7.456 1 13.12 1 19.36c0 5.088 3.072 8.064 6.624 8.064 3.36 0 5.856-2.688 5.856-5.856 0-3.168-2.208-5.472-5.088-5.472-.576 0-1.344.096-1.536.192.48-3.264 3.552-7.104 6.624-9.024L9.352 4zm16.512 0c-4.8 3.456-8.256 9.12-8.256 15.36 0 5.088 3.072 8.064 6.624 8.064 3.264 0 5.856-2.688 5.856-5.856 0-3.168-2.304-5.472-5.184-5.472-.576 0-1.248.096-1.44.192.48-3.264 3.456-7.104 6.528-9.024L25.864 4z" />
              </svg>
              <p className="mt-6 text-2xl font-medium text-white">
                Jetstream is easily the most used Salesforce tool at Reddit. Forget about just loading data - it can move and compare
                metadata between orgs, manage field level security in bulk, and so much more. The best part is that Jetstream is intuitive
                enough for people without a Salesforce background to use. Our finance team loves it for quickly pulling reports. If only I
                had a dollar for every time someone asked, "What is that tool?!" while sharing my screen!
              </p>
            </div>
            <footer className="mt-6">
              <p className="text-base font-medium text-white">Logan Ganieany</p>
              <p className="text-base font-medium text-cyan-100">Senior Salesforce Architect at Reddit</p>
            </footer>
          </blockquote>
        </div>
      </div>
    </div>
  </div>
);

export default Testimonial;
