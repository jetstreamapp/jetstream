import Link from 'next/link';
import LastUpdated from '../../components/LastUpdated';
import PrintButton from '../../components/PrintButton';
import Layout from '../../components/layouts/Layout';
import { ROUTES } from '../../utils/environment';

export default function Page() {
  const email = 'support@getjetstream.app';
  return (
    <div className="m-8">
      <div className="flex items-center justify-between gap-4">
        <LastUpdated className="text-gray-500" day={4} month="August" year={2026} />
        <PrintButton />
      </div>
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
        <li>
          Process Personal Data only on documented instructions from the Controller, including with regard to transfers of Personal Data to
          a third country or an international organization, unless required to do so by applicable law to which the Processor is subject; in
          such a case, the Processor shall inform the Controller of that legal requirement before processing, unless that law prohibits such
          information on important grounds of public interest;
        </li>
        <li>Ensure that persons authorized to process the Personal Data are subject to appropriate confidentiality obligations;</li>
        <li>Implement appropriate technical and organizational measures designed to ensure a level of security appropriate to the risk;</li>
        <li>Assist the Controller in responding to requests from Data Subjects, taking into account the nature of the processing;</li>
        <li>
          Assist the Controller in ensuring compliance with obligations related to security, breach notification, and data protection impact
          assessments, taking into account the nature of processing and the information available to Processor;
        </li>
        <li>
          Delete or return Personal Data to the Controller after the end of the provision of services, in accordance with Section 14 of this
          DPA;
        </li>
        <li>Make available to the Controller information reasonably necessary to demonstrate compliance with this DPA;</li>
        <li>
          Immediately inform the Controller if, in the Processor's opinion, an instruction from the Controller infringes applicable Data
          Protection Laws.
        </li>
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
      <p className="mb-2 pl-2">
        A description of the technical and organizational measures implemented by the Processor is set out in Annex 2 to this DPA.
      </p>

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
        The Processor shall notify the Controller without undue delay, and in any event no later than 48 hours after becoming aware of a
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
        implemented appropriate safeguards in accordance with applicable Data Protection Laws.
      </p>
      <p className="mb-2 pl-2">
        Where the Processor processes Personal Data protected by the GDPR and transfers that Personal Data to a country that has not been
        the subject of an adequacy decision, such transfers are governed by the standard contractual clauses adopted by the European
        Commission in Implementing Decision (EU) 2021/914 (the "EU SCCs"), Module Two (Controller to Processor), which are incorporated into
        this DPA by reference. For the purposes of the EU SCCs:
      </p>
      <ol className="list-decimal pl-6">
        <li>Clause 7 (the docking clause) does not apply;</li>
        <li>
          In Clause 9(a), Option 2 (general written authorization) applies, and the minimum period for prior notice of Sub-processor changes
          is 30 days, as described in Section 7 of this DPA;
        </li>
        <li>In Clause 11(a), the optional independent dispute resolution language does not apply;</li>
        <li>In Clause 17, Option 1 applies and the EU SCCs are governed by the law of Ireland;</li>
        <li>In Clause 18(b), disputes shall be resolved before the courts of Ireland;</li>
        <li>
          Annex I.A (List of Parties) is completed with the Controller as data exporter and Jetstream Solutions, LLC as data importer, using
          the contact details set out in the Agreement and in Section 17 of this DPA;
        </li>
        <li>
          Annex I.B (Description of Transfer) is set out in Annex 1 to this DPA, and the frequency of the transfer is continuous for the
          duration of the Agreement;
        </li>
        <li>Annex I.C (Competent Supervisory Authority) is determined in accordance with Clause 13(a) of the EU SCCs;</li>
        <li>Annex II (Technical and Organisational Measures) is set out in Annex 2 to this DPA; and</li>
        <li>
          Annex III (List of Sub-processors) is the list of Sub-processors published at{' '}
          <Link href={ROUTES.SUB_PROCESSORS} className="underline">
            {ROUTES.SUB_PROCESSORS}
          </Link>
          , as maintained from time to time in accordance with Section 7 of this DPA.
        </li>
      </ol>
      <p className="mb-2 pl-2">
        Where the Processor processes Personal Data protected by the UK GDPR, the EU SCCs apply as varied by the International Data Transfer
        Addendum to the EU Commission Standard Contractual Clauses issued by the UK Information Commissioner under section 119A(1) of the
        Data Protection Act 2018, version B1.0 (the "UK Addendum"), which is incorporated into this DPA by reference. Table 1 of the UK
        Addendum is completed with the parties' details described above; Tables 2 and 3 are completed by reference to the EU SCCs and their
        Annexes as described above; and in Table 4, neither party may end the UK Addendum as set out in Section 19 of the UK Addendum.
      </p>
      <p className="mb-2 pl-2">
        Where the Processor processes Personal Data protected by the Swiss Federal Act on Data Protection ("FADP"), the EU SCCs apply with
        the following adaptations: references to the GDPR are understood as references to the FADP; the competent supervisory authority is
        the Swiss Federal Data Protection and Information Commissioner; and the term "member state" shall not be interpreted so as to
        exclude Data Subjects in Switzerland from exercising their rights in their place of habitual residence.
      </p>
      <p className="mb-2 pl-2">
        In the event of any conflict between the EU SCCs (including as varied by the UK Addendum, where applicable) and the other provisions
        of this DPA, the EU SCCs prevail.
      </p>

      <h2>12. CALIFORNIA CONSUMER PRIVACY ACT</h2>
      <p className="mb-2 pl-2">
        This Section 12 applies to the extent the Processor processes Personal Information on behalf of the Controller and the Controller is
        a "business" as defined by the CCPA. Terms used in this Section 12 that are defined in the CCPA - including "business," "business
        purpose," "commercial purpose," "consumer," "personal information," "sell," "share," and "service provider" - have the meanings
        given to them in the CCPA.
      </p>
      <p className="mb-2 pl-2">
        The parties acknowledge and agree that the Controller is a business and the Processor is a service provider. Personal Information is
        made available by the Controller to the Processor solely for the limited and specified business purposes described in Section 2 of
        this DPA and in Annex 1.
      </p>
      <p className="mb-2 pl-2">The Processor shall:</p>
      <ol className="list-decimal pl-6">
        <li>Not sell or share Personal Information;</li>
        <li>
          Not retain, use, or disclose Personal Information for any purpose other than the business purposes specified in this DPA and the
          Agreement, including for a commercial purpose other than those business purposes, except as otherwise permitted by the CCPA;
        </li>
        <li>
          Not retain, use, or disclose Personal Information outside the direct business relationship between the Processor and the
          Controller;
        </li>
        <li>
          Not combine Personal Information received from or on behalf of the Controller with Personal Information received from or on behalf
          of any third party, or collected from the Processor's own interaction with a consumer, except as permitted by the CCPA;
        </li>
        <li>
          Comply with the applicable obligations of the CCPA and provide the same level of privacy protection to Personal Information as is
          required of the Controller by the CCPA;
        </li>
        <li>
          Notify the Controller promptly, and in any event without undue delay, if the Processor determines that it can no longer meet its
          obligations under the CCPA;
        </li>
        <li>
          Impose on any Sub-processor engaged to process Personal Information, by written contract, the same restrictions and obligations
          set out in this Section 12; and
        </li>
        <li>
          Assist the Controller in responding to consumer requests to know, delete, correct, opt out of the sale or sharing of Personal
          Information, and limit the use of sensitive personal information, taking into account the nature of the processing and the
          information available to the Processor.
        </li>
      </ol>
      <p className="mb-2 pl-2">
        The Processor certifies that it understands the restrictions set out in this Section 12 and will comply with them.
      </p>
      <p className="mb-2 pl-2">
        The Controller may, upon reasonable written notice, take reasonable and appropriate steps to stop and remediate unauthorized use of
        Personal Information by the Processor, including through the information and audit rights set out in Section 10 of this DPA.
      </p>

      <h2>13. TERM AND TERMINATION</h2>
      <p className="mb-2 pl-2">
        This DPA shall remain in effect for as long as the Processor processes Personal Data on behalf of the Controller under the
        Agreement.
      </p>

      <h2>14. RETURN OR DELETION OF DATA</h2>
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

      <h2>15. CHANGES TO THIS DPA</h2>
      <p className="mb-2 pl-2">
        The Processor may update this DPA from time to time to reflect changes in the services, changes in applicable Data Protection Laws,
        or improvements to the Processor's privacy and security practices. The current version of this DPA is published at{' '}
        <Link href={ROUTES.DPA} className="underline">
          {ROUTES.DPA}
        </Link>
        , the date of the most recent update appears at the top of this page, and prior versions are summarized in the Version History
        below.
      </p>
      <p className="mb-2 pl-2">
        Changes that add obligations on the Processor, clarify existing practices, correct errors, or are required to comply with applicable
        law take effect upon posting. Where a change would materially and adversely affect the Controller's rights under this DPA, the
        Processor will provide at least 30 days' advance notice by posting the updated DPA and, where the Controller has provided contact
        details for privacy or legal notices, by email to those details. Changes to the list of Sub-processors are governed by Section 7 of
        this DPA rather than by this Section 15.
      </p>
      <p className="mb-2 pl-2">
        No update to this published DPA modifies any copy of this DPA that the parties have separately executed or countersigned. Such a
        copy may be amended only by a written amendment signed by both parties.
      </p>
      <p className="mb-2 pl-2">
        No update to this DPA may conflict with the EU SCCs or the UK Addendum incorporated under Section 11, and in the event of any
        conflict, those clauses prevail.
      </p>

      <h2>16. MISCELLANEOUS PROVISIONS</h2>
      <p className="mb-2 pl-2">
        In case of conflict between this DPA and any other agreement between the parties, the provisions of this DPA shall prevail solely
        with respect to the parties' data protection obligations.
      </p>
      <p className="mb-2 pl-2">
        Except as otherwise expressly stated in this DPA, this DPA does not modify or supersede the limitations of liability set forth in
        the Agreement.
      </p>
      <p className="mb-2 pl-2">
        This DPA is governed by the governing law and dispute resolution provisions set out in the Agreement, except that the EU SCCs and
        the UK Addendum are governed by the law and subject to the forum specified in Section 11.
      </p>
      <p className="mb-2 pl-2">
        If any provision of this DPA is found by a court of competent jurisdiction to be invalid or unenforceable, the invalidity of such
        provision shall not affect the other provisions of this DPA, which shall remain in full force and effect.
      </p>

      <h2>17. CONTACT INFORMATION</h2>
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

      <h2>ANNEX 2 - TECHNICAL AND ORGANIZATIONAL MEASURES</h2>
      <p className="mb-2 pl-2">
        The following describes the technical and organizational measures implemented by the Processor. The Processor may update these
        measures from time to time, provided that such updates do not materially decrease the overall level of protection afforded to
        Personal Data.
      </p>

      <h3>Encryption and Key Management</h3>
      <ul className="mb-2 list-disc pl-6">
        <li>
          Data in transit is encrypted using TLS 1.2 or higher (TLS 1.3 preferred). HTTPS is enforced on all public-facing endpoints;
          plaintext HTTP is not served.
        </li>
        <li>
          Sensitive data at rest - including Salesforce connection credentials, the production database, and backups - is encrypted using
          AES-256 or equivalent, as provided by the infrastructure platform.
        </li>
        <li>
          Industry-standard cryptographic libraries provided by the runtime and infrastructure platforms are used. No custom cryptographic
          implementations are used.
        </li>
        <li>
          Application-level secrets are stored in an encrypted environment-variable vault; administrative access to the vault requires
          authenticated access with multi-factor authentication.
        </li>
        <li>Secrets are never committed to source control, stored in plaintext files, or written to logs.</li>
        <li>
          Keys are rotated immediately upon known or suspected compromise, or upon the departure of personnel with knowledge of key values.
        </li>
      </ul>

      <h3>Access Control and Authentication</h3>
      <ul className="mb-2 list-disc pl-6">
        <li>Unique user IDs are required for all authentication to applications, operating systems, databases, and network devices.</li>
        <li>Role-based access control is applied following the principle of least privilege.</li>
        <li>
          Access is provisioned based on documented business need, reviewed at each change in role, and revoked upon termination (target:
          within one business day).
        </li>
        <li>
          Multi-factor authentication is required for all administrative and production system access. WebAuthn hardware or embedded tokens
          are preferred; authenticator applications are accepted where hardware is not supported.
        </li>
        <li>
          Single Sign-On is used wherever the platform supports it. Where SSO is not available, password requirements follow NIST SP 800-63B
          guidance, credentials are unique per account, and credentials are stored in an approved password manager.
        </li>
        <li>Privileged access is restricted, monitored, and reviewed at least quarterly.</li>
        <li>
          Quarterly independent external access reviews cover administrative accounts, privileged access, multi-factor authentication
          status, and API keys and service accounts. Dated written sign-offs are retained as audit evidence.
        </li>
        <li>Authentication credentials can be revoked immediately upon suspected compromise, role change, or departure.</li>
        <li>Access requests and approvals are recorded with a minimum retention of one year.</li>
      </ul>

      <h3>Endpoint and Device Security</h3>
      <ul className="mb-2 list-disc pl-6">
        <li>Full disk encryption is required on all devices with access to production systems.</li>
        <li>Automatic screen lock is enforced after no more than five minutes of inactivity.</li>
        <li>Automatic operating system and security updates are enabled.</li>
        <li>Remote wipe capability is enabled. Jailbroken or rooted devices are prohibited.</li>
        <li>Lost or stolen devices must be reported immediately and trigger incident response.</li>
      </ul>

      <h3>Network and Infrastructure Security</h3>
      <ul className="mb-2 list-disc pl-6">
        <li>DDoS protection and a Web Application Firewall are applied at the network edge.</li>
        <li>Production, staging, and development environments are logically separated.</li>
        <li>Database access is restricted to authorized IP addresses and authenticated via platform-managed network isolation.</li>
        <li>Administrative access to infrastructure requires multi-factor authentication and is logged.</li>
        <li>No inbound network access from the public internet is permitted to developer workstations.</li>
        <li>
          Production infrastructure is provided by cloud providers maintaining SOC 2 Type II certifications. Network device hardening,
          patching, access control, and baseline configuration standards are inherited from those providers and validated through annual
          review of their attestation reports.
        </li>
      </ul>

      <h3>Logging and Monitoring</h3>
      <ul className="mb-2 list-disc pl-6">
        <li>Centralized log aggregation and analysis is performed across production infrastructure.</li>
        <li>Application, system, authentication, and error logs are collected from production systems.</li>
        <li>
          Authentication and access audit events are retained for at least 365 days; application and system logs for 365 days; error and
          exception metadata for 30 days; email logs for 180 days.
        </li>
        <li>System clocks are synchronized via platform-managed NTP to ensure accurate correlation of security events.</li>
      </ul>

      <h3>Secure Development and Change Management</h3>
      <ul className="mb-2 list-disc pl-6">
        <li>
          All code changes undergo static analysis, automated dependency scanning, and supply chain monitoring, and are tested in continuous
          integration before reaching production.
        </li>
        <li>Changes are tracked through version control with an auditable history.</li>
        <li>
          Critical vulnerabilities are expedited for remediation (target: within 48 hours of a fix being available); all other security
          patches are remediated within 90 days of availability.
        </li>
      </ul>

      <h3>Personnel Security</h3>
      <ul className="mb-2 list-disc pl-6">
        <li>Background and reference checks are performed prior to or within 30 days of hire, where legally permitted.</li>
        <li>
          Security awareness training is completed within seven days of start date or before system access is granted, whichever is earlier,
          with annual refreshers thereafter.
        </li>
        <li>
          All personnel acknowledge the Code of Conduct, Acceptable Use Policy, and confidentiality obligations prior to receiving access,
          and re-acknowledge them annually.
        </li>
        <li>
          On departure, access to production systems and SaaS applications is revoked on or before the departure date (target: within one
          business day), devices are returned and securely wiped, and keys or secrets known to the departing individual are reviewed for
          rotation.
        </li>
      </ul>

      <h3>Sub-processor Management</h3>
      <ul className="mb-2 list-disc pl-6">
        <li>
          Sub-processors and critical vendors are tracked in a vendor inventory with due diligence evidence, executed data protection
          agreements, and annual review records.
        </li>
        <li>A security assessment is performed before engagement and at least annually thereafter for critical vendors.</li>
        <li>
          The current Sub-processor list is published at{' '}
          <Link href={ROUTES.SUB_PROCESSORS} className="underline">
            {ROUTES.SUB_PROCESSORS}
          </Link>
          .
        </li>
      </ul>

      <h3>Business Continuity and Backup</h3>
      <ul className="mb-2 list-disc pl-6">
        <li>
          A documented Business Continuity and Disaster Recovery plan defines recovery objectives, backup procedures, restoration
          procedures, roles and responsibilities, and testing cadence.
        </li>
        <li>
          Production database backups use continuous write-ahead-log streaming, enabling point-in-time recovery within a rolling seven-day
          window.
        </li>
        <li>
          A scheduled daily job exports a snapshot of the production database to a geographically separate location as an independent
          off-platform copy, retained for seven days.
        </li>
        <li>Backup data is encrypted at rest under the infrastructure platform key management.</li>
        <li>
          Quarterly backup verification confirms point-in-time recovery currency, retention window, export size consistency, and
          off-platform replication. A full restore capability test is conducted at least annually.
        </li>
        <li>Customer Salesforce record data is not stored and is therefore not included in backups.</li>
      </ul>

      <h3>Physical Security</h3>
      <ul className="mb-2 list-disc pl-6">
        <li>
          Jetstream operates as a fully cloud-hosted, remote-first organization with no company-owned or leased office space, server room,
          or data center.
        </li>
        <li>
          Physical security of production infrastructure - including facility access controls, environmental protections, and surveillance -
          is inherited from cloud providers maintaining SOC 2 Type II certifications and validated through annual review of their
          attestation reports.
        </li>
        <li>
          Devices are never left unattended in public spaces, screens are locked when unattended, and no customer data is stored on printed
          media.
        </li>
        <li>
          End-user devices are securely wiped using the manufacturer secure erase function before disposal, recycling, or repurposing.
        </li>
      </ul>

      <h3>Governance and Compliance</h3>
      <ul className="mb-2 list-disc pl-6">
        <li>The security program is aligned with the SOC 2 Trust Services Criteria.</li>
        <li>Security policies are documented, reviewed, and updated at least annually.</li>
        <li>
          A formal risk management process identifies, analyzes, prioritizes, treats, and monitors information security and operational
          risks.
        </li>
      </ul>

      <h2>VERSION HISTORY</h2>
      <p className="mb-2 pl-2">
        The following summarizes material revisions to this DPA. Copies separately executed or countersigned by the parties remain governed
        by the version in effect at signing, as described in Section 15.
      </p>
      <ul className="mb-2 list-disc pl-6">
        <li>
          <strong>August 4, 2026</strong> - Incorporated the EU Standard Contractual Clauses, the UK Addendum, and Swiss FADP adaptations
          (Section 11); added CCPA service provider restrictions (Section 12); shortened Security Incident notification from 72 hours to 48
          hours (Section 9); added a Changes to this DPA section (Section 15); added Annex 2 (Technical and Organizational Measures);
          expanded Processor obligations, audit rights, and data retention terms.
        </li>
        <li>
          <strong>March 18, 2026</strong> - Clarified the relationship between this DPA and the Agreement; added the UK GDPR to the
          definition of Data Protection Laws; added a definition of Security Incident; expanded Processor obligations and audit rights;
          added Annex 1 (Details of Processing); extended Security Incident notification from 48 hours to 72 hours (Section 9).
        </li>
        <li>
          <strong>April 5, 2025</strong> - Initial publication.
        </li>
      </ul>
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
