import Link from 'next/link';
import LastUpdated from '../../components/LastUpdated';
import Layout from '../../components/layouts/Layout';
import { ROUTES } from '../../utils/environment';

export default function Page() {
  const email = 'support@getjetstream.app';
  return (
    <div className="m-8">
      <LastUpdated className="text-gray-500" day={18} month="March" year={2026} />
      <h1>Data Processing Agreement</h1>

      <p className="mb-2 pl-2">
        This Data Processing Agreement ("DPA") forms part of the agreement between Jetstream ("Processor") and the customer ("Controller")
        governing the provision of Jetstream services (the "Agreement") and applies to the processing of Personal Data by Processor on
        behalf of Controller.
      </p>

      <p className="mb-2 pl-2">
        For clarity, when you use Jetstream services, you (our customer) are considered the "Controller" of your data, and Jetstream is
        considered the "Processor" that processes data on your behalf.
      </p>

      <h2>1. DEFINITIONS</h2>
      <p className="mb-2 pl-2">"Personal Data" means any information relating to an identified or identifiable natural person.</p>
      <p className="mb-2 pl-2">
        "Data Protection Laws" means all applicable laws and regulations regarding the processing of Personal Data, including, as
        applicable, the EU General Data Protection Regulation ("GDPR"), the UK GDPR, and the California Consumer Privacy Act ("CCPA"), as
        amended from time to time.
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
      <p className="mb-2 pl-2">
        "Security Incident" means a confirmed breach of security leading to the accidental or unlawful destruction, loss, alteration,
        unauthorized disclosure of, or access to, Personal Data processed by Processor on behalf of Controller.
      </p>

      <h2>2. SCOPE AND PURPOSE OF PROCESSING</h2>
      <p className="mb-2 pl-2">
        The Processor shall process Personal Data solely for the purpose of providing, maintaining, supporting, and securing the Jetstream
        services to the Controller as described in the Agreement and in accordance with the Controller's documented instructions.
      </p>
      <p className="mb-2 pl-2">
        As outlined in our Privacy Policy, Jetstream does not store Salesforce record data except as directed by the Controller through use
        of the services. Jetstream may temporarily store limited metadata in logs for troubleshooting, security, and operational purposes,
        subject to applicable retention periods. If Controller enables features such as History Sync, Jetstream may store Salesforce
        metadata as necessary to provide the services. Such data is stored in a secure environment and processed only for the purposes of
        providing, maintaining, and supporting the services.
      </p>

      <h2>3. OBLIGATIONS OF THE PROCESSOR</h2>
      <p className="mb-2 pl-2">The Processor shall:</p>
      <ol className="list-decimal pl-6">
        <li>Process Personal Data only on documented instructions from the Controller, unless otherwise required by applicable law;</li>
        <li>Ensure that persons authorized to process the Personal Data are subject to appropriate confidentiality obligations;</li>
        <li>Implement appropriate technical and organizational measures designed to ensure a level of security appropriate to the risk;</li>
        <li>Assist the Controller in responding to requests from Data Subjects, taking into account the nature of the processing;</li>
        <li>
          Assist the Controller in ensuring compliance with obligations related to security, breach notification, and data protection impact
          assessments, taking into account the nature of processing and the information available to Processor;
        </li>
        <li>
          Delete or return Personal Data to the Controller after the end of the provision of services, in accordance with Section 13 of this
          DPA;
        </li>
        <li>Make available to the Controller information reasonably necessary to demonstrate compliance with this DPA.</li>
      </ol>

      <h2>4. RIGHTS AND OBLIGATIONS OF THE CONTROLLER</h2>
      <p className="mb-2 pl-2">The Controller shall:</p>
      <ol className="list-decimal pl-6">
        <li>Provide lawful instructions to the Processor regarding the processing of Personal Data;</li>
        <li>Ensure it has the legal basis to process the Personal Data and to engage the Processor;</li>
        <li>
          Be responsible for the accuracy, quality, and legality of the Personal Data and the means by which Controller acquired the
          Personal Data;
        </li>
        <li>
          Inform the Processor of any changes to applicable Data Protection Laws that materially affect the Processor's obligations under
          this DPA.
        </li>
      </ol>

      <h2>5. SECURITY MEASURES</h2>
      <p className="mb-2 pl-2">
        Taking into account the state of the art, the costs of implementation, and the nature, scope, context, and purposes of processing,
        as well as the risks to individuals, the Processor will implement appropriate technical and organizational measures designed to
        protect Personal Data against accidental or unlawful destruction, loss, alteration, unauthorized disclosure, or access.
      </p>
      <p className="mb-2 pl-2">Such measures may include, as appropriate:</p>
      <ol className="list-decimal pl-6">
        <li>Encryption of data at rest and in transit;</li>
        <li>Access controls designed to restrict access to authorized personnel on a need-to-know basis;</li>
        <li>Processes for regularly assessing and testing security measures;</li>
        <li>Secure development, deployment, and operational practices;</li>
        <li>Measures designed to support the ongoing confidentiality, integrity, availability, and resilience of processing systems.</li>
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
        Jetstream will provide notice of material changes concerning the addition or replacement of Sub-processors by updating the
        Sub-processors page or by other reasonable means. If you have concerns about a new Sub-processor, contact us within 30 days of the
        update to discuss reasonable alternatives.
      </p>
      <p className="mb-2 pl-2">
        The Processor shall impose data protection obligations on Sub-processors that are no less protective than those set out in this DPA,
        to the extent applicable to the services performed by the Sub-processor.
      </p>

      <h2>8. DATA SUBJECT RIGHTS</h2>
      <p className="mb-2 pl-2">
        The Processor shall assist the Controller in responding to requests from Data Subjects exercising their rights under applicable Data
        Protection Laws, taking into account the nature of the processing. If a Data Subject contacts the Processor directly regarding
        Personal Data processed under this DPA, the Processor shall promptly forward the request to the Controller unless legally
        prohibited.
      </p>

      <h2>9. SECURITY INCIDENT NOTIFICATION</h2>
      <p className="mb-2 pl-2">
        The Processor shall notify the Controller without undue delay, and in any event no later than 72 hours after becoming aware of a
        confirmed Security Incident affecting Personal Data processed on behalf of the Controller.
      </p>
      <p className="mb-2 pl-2">
        To the extent available, such notification will include relevant details regarding the nature of the Security Incident, the
        categories of Personal Data affected, and measures taken or proposed to address the Security Incident and mitigate its possible
        adverse effects.
      </p>

      <h2>10. AUDIT RIGHTS</h2>
      <p className="mb-2 pl-2">
        Upon reasonable written request, and no more than once annually unless required by applicable law or following a Security Incident,
        the Processor shall provide reasonable information and documentation to demonstrate compliance with this DPA.
      </p>
      <p className="mb-2 pl-2">As a cloud-based service, audits may include:</p>
      <ol className="list-decimal pl-6">
        <li>Written responses to reasonable security and compliance questionnaires;</li>
        <li>Provision of relevant certifications and third-party audit reports, where available;</li>
        <li>Documentation of security practices and data handling procedures;</li>
        <li>Summary reports of compliance activities and security measures.</li>
      </ol>
      <p className="mb-2 pl-2">
        The Controller shall provide at least 30 days' advance written notice for any audit request. Any audit activities shall be conducted
        in a manner that minimizes disruption to the Processor's operations and does not compromise the security, confidentiality, or
        privacy of other customers' data. Direct access to systems or infrastructure is not included in audit rights. Additional audit
        activities beyond the materials described above may be subject to reasonable fees.
      </p>

      <h2>11. DATA TRANSFERS</h2>
      <p className="mb-2 pl-2">
        The Processor shall not transfer Personal Data outside the European Economic Area, the United Kingdom, or Switzerland unless it has
        implemented appropriate safeguards in accordance with applicable Data Protection Laws, including, where applicable, Standard
        Contractual Clauses or another lawful transfer mechanism.
      </p>

      <h2>12. TERM AND TERMINATION</h2>
      <p className="mb-2 pl-2">
        This DPA shall remain in effect for as long as the Processor processes Personal Data on behalf of the Controller under the
        Agreement.
      </p>

      <h2>13. RETURN OR DELETION OF DATA</h2>
      <p className="mb-2 pl-2">
        Upon termination of the services, the Processor shall, at the choice of the Controller, delete or return Personal Data to the
        Controller and delete existing copies unless applicable law requires retention of the Personal Data.
      </p>
      <p className="mb-2 pl-2">
        Notwithstanding the foregoing, the Processor may retain limited Personal Data in backups, security logs, and other routine business
        records for a limited period where required by law or reasonably necessary for security, fraud prevention, dispute resolution, or
        compliance purposes, after which such retained data will be deleted in accordance with Processor's retention practices.
      </p>
      <p className="mb-2 pl-2">
        For clarity, when you delete your Jetstream account, data stored in Jetstream's core service database is deleted in accordance with
        Jetstream's applicable retention and deletion practices.
      </p>

      <h2>14. MISCELLANEOUS PROVISIONS</h2>
      <p className="mb-2 pl-2">
        In case of conflict between this DPA and any other agreement between the parties, the provisions of this DPA shall prevail solely
        with respect to the parties' data protection obligations.
      </p>
      <p className="mb-2 pl-2">
        Except as otherwise expressly stated in this DPA, this DPA does not modify or supersede the limitations of liability set forth in
        the Agreement.
      </p>
      <p className="mb-2 pl-2">
        If any provision of this DPA is found by a court of competent jurisdiction to be invalid or unenforceable, the invalidity of such
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

      <h2>ANNEX 1 - DETAILS OF PROCESSING</h2>
      <p className="mb-2 pl-2">
        <strong>Subject Matter:</strong> Processing of Personal Data in connection with the provision of Jetstream services.
      </p>
      <p className="mb-2 pl-2">
        <strong>Nature and Purpose of Processing:</strong> Processing necessary to provide, maintain, support, secure, and improve the
        services, including hosting, authentication, customer support, troubleshooting, analytics, and related operational functions.
      </p>
      <p className="mb-2 pl-2">
        <strong>Categories of Data Subjects:</strong> Controller's employees, contractors, end users, and other individuals whose Personal
        Data is included in Customer Data submitted to the services.
      </p>
      <p className="mb-2 pl-2">
        <strong>Categories of Personal Data:</strong> Identifiers, contact information, account information, authentication data, metadata,
        support data, system-generated logs, and any other Personal Data submitted by or on behalf of the Controller through use of the
        services.
      </p>
      <p className="mb-2 pl-2">
        <strong>Duration of Processing:</strong> For the term of the Agreement and for any additional period required to complete the return
        or deletion process, comply with applicable law, or maintain limited retained data as described in this DPA.
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
