import Head from 'next/head';
import { Fragment } from 'react';
import Footer from '../../components/Footer';
import Navigation from '../../components/Navigation';

function Privacy() {
  const email = 'support@getjetstream.app';
  return (
    <Fragment>
      <Head>
        <title>Privacy | Jetstream</title>
        <meta
          name="description"
          content="Jetstream is a set of tools that supercharge your administration of Salesforce.com. Jetstream is built for administrators, developers, quality assurance, or power users that want to speed up your management of Salesforce. Jetstream comes with an advanced query builder for viewing records, a powerful data loader for making changes to your record data, and many more features!"
        />
        <link rel="icon" type="image/png" href="/images/favicon.ico"></link>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />

        <meta name="theme-color" content="#ffffff" />

        <link rel="apple-touch-icon" sizes="57x57" href="/assets/images/apple-icon-57x57.png" />
        <link rel="apple-touch-icon" sizes="60x60" href="/assets/images/apple-icon-60x60.png" />
        <link rel="apple-touch-icon" sizes="72x72" href="/assets/images/apple-icon-72x72.png" />
        <link rel="apple-touch-icon" sizes="76x76" href="/assets/images/apple-icon-76x76.png" />
        <link rel="apple-touch-icon" sizes="114x114" href="/assets/images/apple-icon-114x114.png" />
        <link rel="apple-touch-icon" sizes="120x120" href="/assets/images/apple-icon-120x120.png" />
        <link rel="apple-touch-icon" sizes="144x144" href="/assets/images/apple-icon-144x144.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/assets/images/apple-icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/assets/images/apple-icon-180x180.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/assets/images/android-icon-192x192.png" />

        <link rel="manifest" href="/assets/images/manifest.json" />

        <meta name="msapplication-TileColor" content="#ffffff" />
        <meta name="msapplication-TileImage" content="/images/ms-icon-144x144.png" />

        <link rel="icon" type="image/png" sizes="32x32" href="/assets/images/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="96x96" href="/assets/images/favicon-96x96.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/assets/images/favicon-16x16.png" />
      </Head>
      <Navigation />
      <div className="m-8">
        <h1>Privacy Policy</h1>
        <p className="mb-2 pl-2">
          This Privacy Policy describes how your personal information is collected, used, and shared when you visit or make a purchase from
          https://getjetstream.app (the “Site”).
        </p>
        <h2>Privacy and Security Summary</h2>
        <ol className="list-decimal pl-6">
          <li>
            We strive to follow industry best practices for all processes, including our development processes, deployment processes,
            hosting processes, and data access processes.
          </li>
          <li>We never store any of your Salesforce record data.</li>
          <li>We use browser-based caching to avoid having to store any metadata on our server.</li>
          <li>We will never make API requests to Salesforce without explicit action from a user, such as executing a query.</li>
          <li>
            All data stored by Jetstream is{' '}
            <a
              className="underline"
              href="https://cloud.google.com/docs/security/encryption/default-encryption"
              target="_blank"
              rel="noreferrer"
            >
              encrypted at rest
            </a>{' '}
            and stored using industry best practices.
          </li>
          <li>
            Some metadata, such as Object and Field names may be included in log entries for up to 1 year with our logging provider. This is
            used only for the purpose of troubleshooting errors and ensuring auditability for security purposes.
          </li>
          <li>
            If there is a fatal error with the application, our bug tracker may store metadata and error messages based on whatever
            Salesforce includes in the error message. Our bug tracker has data retention of 30 days.
          </li>
          <li>All network traffic is encrypted using HTTPS 1.1, HTTPS/2, or HTTPS/3 TLS 1.3 X35519Kyber768Draft00 and AES_128_GCM</li>
          <li>
            Refer to our{' '}
            <a className="underline" href="https://getjetstream.app/subprocessors/" target="_blank" rel="noreferrer">
              data sub-processors
            </a>{' '}
            for information about our vendors.
          </li>
        </ol>
        <h2>PERSONAL INFORMATION WE COLLECT</h2>
        <p className="mb-2 pl-2">
          When you visit the Site, we may automatically collect certain information about your device, including information about your web
          browser, IP address, and time zone. Additionally, as you browse the Site, we collect information about the individual web pages or
          products that you view, what websites or search terms referred you to the Site, and information about how you interact with the
          Site. We refer to this automatically-collected information as “Device Information.”
        </p>
        <p className="mb-2 pl-2">We collect Device Information using the following technologies:</p>
        <ul className="list-disc pl-6">
          <li>
            “Cookies” are data files that are placed on your device or computer and often include an anonymous unique identifier. For more
            information about cookies, and how to disable cookies, visit http://www.allaboutcookies.org.
          </li>
          <li>
            “Log files” track actions occurring on the Site, and collect data including your IP address, browser type, referring/exit pages,
            and date/time stamps.
          </li>
          <li>
            Any information we gather will be used solely for the purpose of improving our product and will not be sold to any 3rd parties.
          </li>
        </ul>
        <p className="mb-2 pl-2">
          Additionally when you make a purchase or attempt to make a purchase through the Site, we collect certain information from you,
          including your name, billing address, payment information, email address, and phone number. We refer to this information as “Order
          Information.”
        </p>
        <p className="mb-2 pl-2">
          When we talk about “Personal Information” in this Privacy Policy, we are talking both about Device Information and Order
          Information.
        </p>
        <h2>SALESFORCE DATA</h2>
        <p className="mb-2 pl-2">
          We will never store any of your Salesforce metadata or record data on any of our servers unless explicitly requested by an action
          taken by you, the user. We may store names of Salesforce objects, fields, or other metadata temporarily in logs, but we will never
          persist this beyond our standard log retention policy of up to 1 year and will only use this data for the purpose of
          troubleshooting or other error identification.
        </p>
        <p className="mb-2 pl-2">
          We encrypt and store connection details to any Salesforce organization in our database so that you can utilize Jetstream to
          connect to your Salesforce org. We do not have access to or store your Salesforce password, and at any time you can revoke access
          to Jetstream through the Salesforce.com setup menu in the "Manage Connected App Usage" section.
        </p>
        <h2>HOW DO WE USE YOUR PERSONAL INFORMATION?</h2>
        <p className="mb-2 pl-2">
          We use the Order Information that we collect generally to fulfill any orders placed through the Site (including processing your
          payment information and providing you with invoices and/or order confirmations). Additionally, we use this Order Information to:
        </p>
        <ul className="list-disc pl-6">
          <li>Communicate with you</li>
          <li>Screen our orders for potential risk or fraud</li>
          <li>
            Based on your preferences you have shared with us, provide you with information or advertising relating to our products or
            services.
          </li>
        </ul>
        <p className="mb-2 pl-2">
          We use the Device Information that we collect to help us screen for potential risk and fraud (in particular, your IP address), and
          more generally to improve and optimize our Site (for example, by generating analytics about how our customers browse and interact
          with the Site, and to assess the success of our marketing and advertising campaigns).
        </p>
        <h2>SHARING YOUR PERSONAL INFORMATION</h2>
        <p className="mb-2 pl-2">
          We share your Personal Information with third parties to help us use your Personal Information, as described above. For example,
          we use Stripe to power our payment collection. We use Amplitude to track what parts of the application is used and in which ways
          to help make product decisions. We also use Google Analytics to help us understand how our customers use the Site - you can read
          more about how Google uses your Personal Information here: https://www.google.com/intl/en/policies/privacy/. You can also opt-out
          of Google Analytics here: https://tools.google.com/dlpage/gaoptout. Finally, we may also share your Personal Information to comply
          with applicable laws and regulations, to respond to a subpoena, search warrant or other lawful request for information we receive,
          or to otherwise protect our rights.
        </p>
        <p className="mb-2 pl-2">
          Refer to our{' '}
          <a className="underline" href="https://getjetstream.app/subprocessors/" target="_blank" rel="noreferrer">
            data sub-processors
          </a>{' '}
          for information about our vendors.
        </p>
        <p className="mb-2 pl-2">
          We will not sell your information to 3rd parties or provide your information to 3rd parties for any other reason.
        </p>
        <h2>DO NOT TRACK</h2>
        <p className="mb-2 pl-2">
          Please note that we do not alter our Site's data collection and use practices when we see a Do Not Track signal from your browser.
        </p>
        <h2>YOUR RIGHTS</h2>
        <p className="mb-2 pl-2">
          If you are a European resident, you have the right to access personal information we hold about you and to ask that your personal
          information be corrected, updated, or deleted. If you would like to exercise this right, please contact us through the contact
          information below.
        </p>
        Additionally, if you are a European resident we note that we are processing your information in order to fulfill contracts we might
        have with you (for example if you make an order through the Site), or otherwise to pursue our legitimate business interests listed
        above. Additionally, please note that your information will be transferred outside of Europe, to the United States.
        <h2>DATA RETENTION</h2>
        <p className="mb-2 pl-2">
          We will store information in our logs for up to 14 days. We will store information related to errors for up to 30 days.
        </p>
        <h2>MINORS</h2>
        <p className="mb-2 pl-2">The Site is not intended for individuals under the age of 13.</p>
        <h2>CHANGES</h2>
        <p className="mb-2 pl-2">
          We may update this privacy policy from time to time in order to reflect, for example, changes to our practices or for other
          operational, legal or regulatory reasons.
        </p>
        <h2>CONTACT US</h2>
        <p className="mb-2 pl-2">
          For more information about our privacy practices, if you have questions, or if you would like to make a complaint, please contact
          us by e-mail at{' '}
          <a className="underline" href={`mailto:${email}?subject=Question about Privacy Policy`} target="_blank" rel="noreferrer">
            {email}
          </a>
          .
        </p>
      </div>
      <Footer />
    </Fragment>
  );
}

export default Privacy;
