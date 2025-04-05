import Link from 'next/link';
import LastUpdated from '../../components/LastUpdated';
import Layout from '../../components/layouts/Layout';
import { ROUTES } from '../../utils/environment';

export default function Page() {
  const email = 'support@getjetstream.app';
  return (
    <div className="m-8">
      <LastUpdated className="text-gray-500" day={5} month="April" year={2025} />
      <h1>Data Processing Agreement</h1>

      <p className="mb-2 pl-2">
        This Data Processing Agreement ("DPA") forms part of the Terms of Service between Jetstream ("Processor") and the Customer
        ("Controller") and applies to the processing of Personal Data by Processor on behalf of Controller.
      </p>

      <p className="mb-2 pl-2">
        For clarity, when you use Jetstream services, you (our customer) are considered the "Controller" of your data, and Jetstream is
        considered the "Processor" that processes data on your behalf.
      </p>

      <h2>1. DEFINITIONS</h2>
      <p className="mb-2 pl-2">"Personal Data" means any information relating to an identified or identifiable natural person.</p>
      <p className="mb-2 pl-2">
        "Data Protection Laws" means all applicable laws and regulations regarding the processing of Personal Data, including but not
        limited to the EU General Data Protection Regulation (GDPR) and the California Consumer Privacy Act (CCPA).
      </p>
      <p className="mb-2 pl-2">
        "Processing" means any operation which is performed on Personal Data, such as collection, recording, organization, storage,
        adaptation, retrieval, consultation, use, disclosure, or otherwise making available.
      </p>
      <p className="mb-2 pl-2">"Data Subject" means an identified or identifiable natural person to whom the Personal Data relates.</p>
      <p className="mb-2 pl-2">
        "Sub-processor" means any processor engaged by the Processor who agrees to receive from the Processor Personal Data for processing
        on behalf of the Controller.
      </p>

      <h2>2. SCOPE AND PURPOSE OF PROCESSING</h2>
      <p className="mb-2 pl-2">
        The Processor shall process Personal Data solely for the purpose of providing the Jetstream services to the Controller as described
        in the Terms of Service and in accordance with the Controller's documented instructions.
      </p>
      <p className="mb-2 pl-2">
        As outlined in our Privacy Policy, we do not store Salesforce record data. We may store metadata temporarily in logs for
        troubleshooting purposes with a retention period of up to 1 year. If you have enabled the "History Sync" feature, we wil store
        Salesforce metadata for the purpose of providing the service. This data is stored in a secure environment and is not shared with any
        third parties.
      </p>

      <h2>3. OBLIGATIONS OF THE PROCESSOR</h2>
      <p className="mb-2 pl-2">The Processor shall:</p>
      <ol className="list-decimal pl-6">
        <li>Process Personal Data only on documented instructions from the Controller;</li>
        <li>Ensure that persons authorized to process the Personal Data have committed themselves to confidentiality;</li>
        <li>Implement appropriate technical and organizational measures to ensure a level of security appropriate to the risk;</li>
        <li>Assist the Controller in responding to requests from Data Subjects;</li>
        <li>
          Assist the Controller in ensuring compliance with obligations related to security, data breach notification, and data protection
          impact assessments;
        </li>
        <li>Delete or return all Personal Data to the Controller after the end of the provision of services;</li>
        <li>Make available to the Controller all information necessary to demonstrate compliance with the obligations in this DPA.</li>
      </ol>

      <h2>4. RIGHTS AND OBLIGATIONS OF THE CONTROLLER</h2>
      <p className="mb-2 pl-2">The Controller shall:</p>
      <ol className="list-decimal pl-6">
        <li>Provide instructions to the Processor regarding the processing of Personal Data;</li>
        <li>Ensure it has the legal basis to process the Personal Data and to engage the Processor;</li>
        <li>Inform the Processor of any changes to applicable Data Protection Laws that may affect the Processor's obligations.</li>
      </ol>

      <h2>5. SECURITY MEASURES</h2>
      <p className="mb-2 pl-2">The Processor implements the following security measures:</p>
      <ol className="list-decimal pl-6">
        <li>All data stored by Jetstream is encrypted at rest and stored using industry best practices;</li>
        <li>All network traffic is encrypted using HTTPS 1.1, HTTPS/2, or HTTPS/3 TLS 1.3 X35519Kyber768Draft00 and AES_128_GCM;</li>
        <li>Access to Personal Data is restricted to authorized personnel only on a need-to-know basis;</li>
        <li>Regular security assessments and testing are conducted;</li>
        <li>Industry best practices for development, deployment, hosting, and data access processes are followed.</li>
      </ol>

      <h2>6. CONFIDENTIALITY</h2>
      <p className="mb-2 pl-2">
        The Processor shall ensure that any person acting under its authority who has access to Personal Data is bound by appropriate
        confidentiality obligations.
      </p>

      <h2>7. SUB-PROCESSORS</h2>
      <p className="mb-2 pl-2">
        The Controller generally authorizes the Processor to engage Sub-processors for the processing of Personal Data. The Processor
        maintains an up-to-date list of Sub-processors at{' '}
        <Link href={ROUTES.SUB_PROCESSORS} className="underline">
          {ROUTES.SUB_PROCESSORS}
        </Link>
        .
      </p>
      <p className="mb-2 pl-2">
        Jetstream will notify customers of any intended changes concerning the addition or replacement of Sub-processors by updating our
        Sub-processors page. If you have concerns about a new Sub-processor, contact us within 30 days of the update to discuss
        alternatives.
      </p>
      <p className="mb-2 pl-2">The Processor shall impose the same data protection obligations on Sub-processors as set out in this DPA.</p>

      <h2>8. DATA SUBJECT RIGHTS</h2>
      <p className="mb-2 pl-2">
        The Processor shall assist the Controller in responding to requests from Data Subjects exercising their rights under applicable Data
        Protection Laws. If a Data Subject contacts the Processor directly, the Processor shall promptly forward the request to the
        Controller.
      </p>

      <h2>9. DATA BREACH NOTIFICATION</h2>
      <p className="mb-2 pl-2">
        The Processor shall notify the Controller without undue delay (and no later than 48 hours) after becoming aware of a personal data
        breach. The notification shall include relevant details about the nature of the breach, categories and approximate number of
        affected Data Subjects, and measures taken or proposed to mitigate adverse effects.
      </p>

      <h2>10. AUDIT RIGHTS</h2>
      <p className="mb-2 pl-2">
        The Processor shall provide reasonable information and documentation to demonstrate compliance with this DPA upon Controller's
        request. As a cloud-based service, audits may include:
      </p>
      <ol className="list-decimal pl-6">
        <li>Written responses to security and compliance questionnaires.</li>
        <li>Provision of relevant certifications and third-party audit reports of cloud service providers used.</li>
        <li>Documentation of security practices and data handling procedures.</li>
        <li>Summary reports of compliance activities and security measures.</li>
      </ol>
      <p className="mb-2 pl-2">
        The Controller shall provide at least 30 days advance written notice for any audit request. Any audit activities shall be conducted
        in a manner that minimizes disruption to the Processor's operations and doesn't compromise the security or confidentiality of other
        customers' data. Direct access to systems or infrastructure is not included in audit rights. Additional audit activities may be
        subject to reasonable fees.
      </p>

      <h2>11. DATA TRANSFERS</h2>
      <p className="mb-2 pl-2">
        The Processor shall not transfer Personal Data outside the European Economic Area (EEA) unless it has implemented appropriate
        safeguards in accordance with applicable Data Protection Laws.
      </p>

      <h2>12. TERM AND TERMINATION</h2>
      <p className="mb-2 pl-2">
        This DPA shall remain in effect as long as the Processor processes Personal Data on behalf of the Controller under the Terms of
        Service.
      </p>

      <h2>13. RETURN OR DELETION OF DATA</h2>
      <p className="mb-2 pl-2">
        Upon termination of the services, the Processor shall, at the choice of the Controller, delete or return all Personal Data to the
        Controller and delete existing copies unless applicable law requires storage of the Personal Data. When you delete your Jetstream
        Account, all of the data we store in our core service database is deleted.
      </p>

      <h2>14. MISCELLANEOUS PROVISIONS</h2>
      <p className="mb-2 pl-2">
        In case of conflict between this DPA and any other agreement between the parties, the provisions of this DPA shall prevail with
        respect to the parties' data protection obligations.
      </p>
      <p className="mb-2 pl-2">
        If any provision of this DPA is found by any court of competent jurisdiction to be invalid or unenforceable, the invalidity of such
        provision shall not affect the other provisions of this DPA, which shall remain in full force and effect.
      </p>

      <h2>15. CONTACT INFORMATION</h2>
      <p className="mb-2 pl-2">
        For questions regarding this DPA, contact us at{' '}
        <a className="underline" href={`mailto:${email}?subject=Question about DPA`} target="_blank" rel="noreferrer">
          {email}
        </a>
        .
      </p>
    </div>
  );
}

Page.getLayout = function getLayout(page) {
  return (
    <Layout title="Data Processing Agreement | Jetstream" navigationProps={{ omitLinks: [ROUTES.DPA] }}>
      {page}
    </Layout>
  );
};
