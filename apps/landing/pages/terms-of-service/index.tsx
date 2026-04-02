import Link from 'next/link';
import LastUpdated from '../../components/LastUpdated';
import Layout from '../../components/layouts/Layout';
import { ROUTES } from '../../utils/environment';

const email = 'support@getjetstream.app';

/**
 * ANY CHANGES TO THIS DOCUMENT MUST BE APPROVED BY LEGAL AND THE LEADERSHIP TEAM.
 * CURRENT_TOS_VERSION MUST BE UPDATED IN libs/auth/server/src/lib/auth.constants.ts
 * WHEN ANY MATERIAL UPDATE IS MADE TO THIS DOCUMENT.
 */

export default function Page() {
  return (
    <div className="m-8">
      <LastUpdated className="text-gray-500" day={2} month="April" year={2026} />
      <h1>TERMS OF SERVICE</h1>
      <h2>OVERVIEW</h2>
      <p className="mb-2 pl-2">
        This website is operated by Jetstream Solutions LLC ("Jetstream"). Throughout the site, the terms "we", "us" and "our" refer to
        Jetstream. Jetstream offers this website, including all information, tools and services available from this site to you, the user,
        conditioned upon your acceptance of all terms, conditions, policies and notices stated here. By visiting our site and/or using our
        Service, you engage in our "Service" and agree to be bound by the following terms and conditions ("Terms of Service", "Terms"),
        including those additional terms and conditions and policies referenced herein and/or available by hyperlink. These Terms of Service
        apply to all users of the site, including without limitation users who are browsers, customers, and/or contributors of content.
        Please read these Terms of Service carefully before accessing or using our website. By accessing or using any part of the site, you
        agree to be bound by these Terms of Service. If you do not agree to all the terms and conditions of this agreement, then you may not
        access the website or use any services. If these Terms of Service are considered an offer, acceptance is expressly limited to these
        Terms of Service. Any new features or tools which are added to the Service shall also be subject to the Terms of Service. You can
        review the most current version of the Terms of Service at any time on this page. We reserve the right to update, change or replace
        any part of these Terms of Service by posting updates and/or changes to our website. It is your responsibility to check this page
        periodically for changes. Your continued use of or access to the website following the posting of any changes constitutes acceptance
        of those changes.
      </p>
      <h2>SECTION 1 - ONLINE TERMS</h2>
      <p className="mb-2 pl-2">
        By agreeing to these Terms of Service, you represent that you are at least the age of majority in your state or province of
        residence, or that you are the age of majority in your state or province of residence and you have given us your consent to allow
        any of your minor dependents to use this site. You may not use our products for any illegal or unauthorized purpose nor may you, in
        the use of the Service, violate any laws in your jurisdiction (including but not limited to copyright laws). You must not transmit
        any worms or viruses or any code of a destructive nature. A breach or violation of any of the Terms will result in an immediate
        termination of your Services.
      </p>
      <h2>SECTION 2 - GENERAL CONDITIONS</h2>
      <p className="mb-2 pl-2">
        We reserve the right to refuse service to anyone for any reason at any time. You understand that your content (not including credit
        card information), may be transferred unencrypted and involve (a) transmissions over various networks; and (b) changes to conform
        and adapt to technical requirements of connecting networks or devices. Credit card information is always encrypted during transfer
        over networks. You agree not to reproduce, duplicate, copy, sell, resell or exploit any portion of the Service, use of the Service,
        or access to the Service or any contact on the website through which the Service is provided, without express written permission by
        us. The headings used in this agreement are included for convenience only and will not limit or otherwise affect these Terms.
      </p>
      <h2>SECTION 3 - ACCURACY, COMPLETENESS AND TIMELINESS OF INFORMATION</h2>
      <p className="mb-2 pl-2">
        We are not responsible if information made available on this site is not accurate, complete or current. The material on this site is
        provided for general information only and should not be relied upon or used as the sole basis for making decisions without
        consulting primary, more accurate, more complete or more timely sources of information. Any reliance on the material on this site is
        at your own risk. This site may contain certain historical information. Historical information, necessarily, is not current and is
        provided for your reference only. We reserve the right to modify the contents of this site at any time, but we have no obligation to
        update any information on our site. You agree that it is your responsibility to monitor changes to our site.
      </p>
      <h2>SECTION 4 - MODIFICATIONS TO THE SERVICE AND PRICES</h2>
      <p className="mb-2 pl-2">
        Prices for our subscription plans are subject to change without notice. We reserve the right at any time to modify or discontinue
        the Service (or any part or content thereof) without notice at any time. We shall not be liable to you or to any third-party for any
        modification, price change, suspension or discontinuance of the Service.
      </p>
      <h2>SECTION 5 - SERVICE AVAILABILITY</h2>
      <p className="mb-2 pl-2">
        The Service is provided as a cloud-based software-as-a-service platform. We use commercially reasonable efforts to maintain
        availability of the Service, but do not guarantee uninterrupted access. The Service may be temporarily unavailable due to scheduled
        maintenance, updates, or circumstances beyond our control. We reserve the right to limit the availability of the Service to any
        person, geographic region, or jurisdiction. We may exercise this right on a case-by-case basis. All descriptions of the Service or
        pricing are subject to change at any time without notice, at our sole discretion. We reserve the right to discontinue any feature of
        the Service at any time. We do not warrant that the quality of the Service or any information obtained through the Service will meet
        your expectations, or that any errors in the Service will be corrected.
      </p>
      <h2>SECTION 6 - ACCURACY OF BILLING AND ACCOUNT INFORMATION</h2>
      <p className="mb-2 pl-2">
        We reserve the right to refuse or cancel any subscription you place with us. We may, in our sole discretion, limit or cancel
        subscriptions per person or per account. In the event that we make a change to or cancel a subscription, we may attempt to notify
        you by contacting the email address provided at the time the account was created. You agree to provide current, complete and
        accurate account and billing information for all subscriptions. You agree to promptly update your account and other information,
        including your email address and payment details, so that we can complete your transactions and contact you as needed.
      </p>
      <h2>SECTION 7 - ACCOUNT SECURITY</h2>
      <p className="mb-2 pl-2">
        You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your
        account. You agree to immediately notify us of any unauthorized use of your account or any other breach of security. We will not be
        liable for any loss or damage arising from your failure to protect your account credentials. You are responsible for ensuring that
        your use of the Service complies with all applicable laws and regulations, including any requirements imposed by your Salesforce
        organization's policies.
      </p>
      <h2>SECTION 8 - SALESFORCE DATA AND CONNECTIVITY</h2>
      <p className="mb-2 pl-2">
        The Service allows you to connect to and interact with your Salesforce organizations. We will not access your Salesforce data
        without explicit action from you. We do not store your Salesforce record data on our servers. Connection details to your Salesforce
        organizations are encrypted and stored in our database solely to facilitate your use of the Service. You may revoke Jetstream's
        access to your Salesforce organization at any time through the Salesforce setup menu. For full details on how we handle your data,
        please refer to our <Link href={ROUTES.PRIVACY}>Privacy Policy</Link>.
      </p>
      <h2>SECTION 9 - THIRD-PARTY TOOLS AND INTEGRATIONS</h2>
      <p className="mb-2 pl-2">
        We may provide you with access to third-party tools over which we neither monitor nor have any control nor input. You acknowledge
        and agree that we provide access to such tools "as is" and "as available" without any warranties, representations or conditions of
        any kind and without any endorsement. We shall have no liability whatsoever arising from or relating to your use of optional
        third-party tools. Any use by you of optional tools offered through the site is entirely at your own risk and discretion and you
        should ensure that you are familiar with and approve of the terms on which tools are provided by the relevant third-party
        provider(s). We may also, in the future, offer new services and/or features through the website (including the release of new tools
        and resources). Such new features and/or services shall also be subject to these Terms of Service.
      </p>
      <h2>SECTION 10 - THIRD-PARTY LINKS</h2>
      <p className="mb-2 pl-2">
        Certain content and services available via our Service may include materials from third-parties. Third-party links on this site may
        direct you to third-party websites that are not affiliated with us. We are not responsible for examining or evaluating the content
        or accuracy and we do not warrant and will not have any liability or responsibility for any third-party materials or websites, or
        for any other materials, products, or services of third-parties. We are not liable for any harm or damages related to the use of
        services, resources, content, or any other transactions made in connection with any third-party websites. Please review carefully
        the third-party's policies and practices and make sure you understand them before you engage in any transaction. Complaints, claims,
        concerns, or questions regarding third-party products should be directed to the third-party.
      </p>
      <h2>SECTION 11 - USER COMMENTS, FEEDBACK AND OTHER SUBMISSIONS</h2>
      <p className="mb-2 pl-2">
        If, at our request, you send certain specific submissions or without a request from us you send creative ideas, suggestions,
        proposals, plans, or other materials, whether online, by email, or otherwise (collectively, "comments"), you agree that we may, at
        any time, without restriction, edit, copy, publish, distribute, translate and otherwise use in any medium any comments that you
        forward to us. We are and shall be under no obligation (1) to maintain any comments in confidence; (2) to pay compensation for any
        comments; or (3) to respond to any comments. We may, but have no obligation to, monitor, edit or remove content that we determine in
        our sole discretion are unlawful, offensive, threatening, libelous, defamatory, pornographic, obscene or otherwise objectionable or
        violates any party's intellectual property or these Terms of Service. You agree that your comments will not violate any right of any
        third-party, including copyright, trademark, privacy, personality or other personal or proprietary right. You further agree that
        your comments will not contain libelous or otherwise unlawful, abusive or obscene material, or contain any computer virus or other
        malware that could in any way affect the operation of the Service or any related website. You may not use a false email address,
        pretend to be someone other than yourself, or otherwise mislead us or third-parties as to the origin of any comments. You are solely
        responsible for any comments you make and their accuracy. We take no responsibility and assume no liability for any comments posted
        by you or any third-party.
      </p>
      <h2>SECTION 12 - PERSONAL INFORMATION</h2>
      <p className="mb-2 pl-2">
        Your submission of personal information through the Service is governed by our <Link href={ROUTES.PRIVACY}>Privacy Policy</Link>.
      </p>
      <h2>SECTION 13 - ERRORS, INACCURACIES AND OMISSIONS</h2>
      <p className="mb-2 pl-2">
        Occasionally there may be information on our site or in the Service that contains typographical errors, inaccuracies or omissions
        that may relate to service descriptions, pricing, promotions, or availability. We reserve the right to correct any errors,
        inaccuracies or omissions, and to change or update information if any information in the Service or on any related website is
        inaccurate at any time without prior notice. We undertake no obligation to update, amend or clarify information in the Service or on
        any related website, including without limitation, pricing information, except as required by law. No specified update or refresh
        date applied in the Service or on any related website should be taken to indicate that all information in the Service or on any
        related website has been modified or updated.
      </p>
      <h2>SECTION 14 - PROHIBITED USES</h2>
      <p className="mb-2 pl-2">
        In addition to other prohibitions as set forth in the Terms of Service, you are prohibited from using the site or its content: (a)
        for any unlawful purpose; (b) to solicit others to perform or participate in any unlawful acts; (c) to violate any international,
        federal, provincial or state regulations, rules, laws, or local ordinances; (d) to infringe upon or violate our intellectual
        property rights or the intellectual property rights of others; (e) to harass, abuse, insult, harm, defame, slander, disparage,
        intimidate, or discriminate based on gender, sexual orientation, religion, ethnicity, race, age, national origin, or disability; (f)
        to submit false or misleading information; (g) to upload or transmit viruses or any other type of malicious code that will or may be
        used in any way that will affect the functionality or operation of the Service or of any related website, other websites, or the
        Internet; (h) to collect or track the personal information of others; (i) to spam, phish, pharm, pretext, spider, crawl, or scrape;
        (j) for any obscene or immoral purpose; or (k) to interfere with or circumvent the security features of the Service or any related
        website, other websites, or the Internet. We reserve the right to terminate your use of the Service or any related website for
        violating any of the prohibited uses.
      </p>
      <h2>SECTION 15 - DISCLAIMER OF WARRANTIES; LIMITATION OF LIABILITY</h2>
      <p className="mb-2 pl-2">
        We do not guarantee, represent or warrant that your use of our Service will be uninterrupted, timely, secure or error-free. We do
        not warrant that the results that may be obtained from the use of the Service will be accurate or reliable. You agree that from time
        to time we may remove the Service for indefinite periods of time or cancel the Service at any time, without notice to you. You
        expressly agree that your use of, or inability to use, the Service is at your sole risk. The Service and all features and services
        delivered to you through the Service are (except as expressly stated by us) provided "as is" and "as available" for your use,
        without any representation, warranties or conditions of any kind, either express or implied, including all implied warranties or
        conditions of merchantability, merchantable quality, fitness for a particular purpose, durability, title, and non-infringement. In
        no case shall Jetstream, our directors, officers, employees, affiliates, agents, contractors, interns, suppliers, service providers
        or licensors be liable for any injury, loss, claim, or any direct, indirect, incidental, punitive, special, or consequential damages
        of any kind, including, without limitation lost profits, lost revenue, lost savings, loss of data, replacement costs, or any similar
        damages, whether based in contract, tort (including negligence), strict liability or otherwise, arising from your use of any of the
        Service, or for any other claim related in any way to your use of the Service, including, but not limited to, any errors or
        omissions in any content, or any loss or damage of any kind incurred as a result of the use of the Service or any content posted,
        transmitted, or otherwise made available via the Service, even if advised of their possibility. In any event, our aggregate
        liability to you for all claims arising out of or relating to the use of or inability to use the Service shall not exceed the total
        amount paid by you to Jetstream during the twelve (12) months immediately preceding the event giving rise to the claim. Because some
        states or jurisdictions do not allow the exclusion or the limitation of liability for consequential or incidental damages, in such
        states or jurisdictions, our liability shall be limited to the maximum extent permitted by law.
      </p>
      <h2>SECTION 16 - INDEMNIFICATION</h2>
      <p className="mb-2 pl-2">
        You agree to indemnify, defend and hold harmless Jetstream and our parent, subsidiaries, affiliates, partners, officers, directors,
        agents, contractors, licensors, service providers, subcontractors, suppliers, interns and employees, harmless from any claim or
        demand, including reasonable attorneys' fees, made by any third-party due to or arising out of your breach of these Terms of Service
        or the documents they incorporate by reference, or your violation of any law or the rights of a third-party.
      </p>
      <h2>SECTION 17 - SEVERABILITY</h2>
      <p className="mb-2 pl-2">
        In the event that any provision of these Terms of Service is determined to be unlawful, void or unenforceable, such provision shall
        nonetheless be enforceable to the fullest extent permitted by applicable law, and the unenforceable portion shall be deemed to be
        severed from these Terms of Service, such determination shall not affect the validity and enforceability of any other remaining
        provisions.
      </p>
      <h2>SECTION 18 - TERMINATION</h2>
      <p className="mb-2 pl-2">
        The obligations and liabilities of the parties incurred prior to the termination date shall survive the termination of this
        agreement for all purposes. These Terms of Service are effective unless and until terminated by either you or us. You may terminate
        these Terms of Service at any time by notifying us that you no longer wish to use our Services, or when you cease using our site. If
        in our sole judgment you fail, or we suspect that you have failed, to comply with any term or provision of these Terms of Service,
        we also may terminate this agreement at any time without notice and you will remain liable for all amounts due up to and including
        the date of termination; and/or accordingly may deny you access to our Services (or any part thereof).
      </p>
      <h2>SECTION 19 - DISPUTE RESOLUTION AND ARBITRATION</h2>
      <p className="mb-2 pl-2">
        Any dispute, controversy, or claim arising out of or relating to these Terms of Service, or the breach, termination, or invalidity
        thereof, shall be resolved by binding arbitration administered in accordance with the rules of the American Arbitration Association.
        The arbitration shall be conducted virtually (via videoconference or other remote means) by a single arbitrator. The arbitrator's
        decision shall be final and binding, and judgment on the award may be entered in any court having jurisdiction thereof. Each party
        shall bear its own costs and attorneys' fees, unless the arbitrator determines otherwise. Notwithstanding the foregoing, either
        party may seek injunctive or other equitable relief in any court of competent jurisdiction to prevent the actual or threatened
        infringement, misappropriation, or violation of intellectual property rights.
      </p>
      <h2>SECTION 20 - CLASS ACTION WAIVER</h2>
      <p className="mb-2 pl-2">
        You agree that any dispute resolution proceedings will be conducted only on an individual basis and not in a class, consolidated, or
        representative action. You expressly waive any right to participate in a class action lawsuit or class-wide arbitration against
        Jetstream. If any court or arbitrator determines that the class action waiver set forth in this section is void or unenforceable for
        any reason, then the arbitration agreement in Section 19 shall be deemed null and void with respect to such proceeding, and the
        dispute shall proceed in a court of competent jurisdiction in the State of Montana.
      </p>
      <h2>SECTION 21 - ENTIRE AGREEMENT</h2>
      <p className="mb-2 pl-2">
        The failure of us to exercise or enforce any right or provision of these Terms of Service shall not constitute a waiver of such
        right or provision. These Terms of Service and any policies or operating rules posted by us on this site or in respect to the
        Service constitutes the entire agreement and understanding between you and us and govern your use of the Service, superseding any
        prior or contemporaneous agreements, communications and proposals, whether oral or written, between you and us (including, but not
        limited to, any prior versions of the Terms of Service). Any ambiguities in the interpretation of these Terms of Service shall not
        be construed against the drafting party.
      </p>
      <h2>SECTION 22 - GOVERNING LAW</h2>
      <p className="mb-2 pl-2">
        These Terms of Service and any separate agreements whereby we provide you Services shall be governed by and construed in accordance
        with the laws of the State of Montana, without regard to its conflict of law provisions.
      </p>
      <h2>SECTION 23 - CHANGES TO TERMS OF SERVICE</h2>
      <p className="mb-2 pl-2">
        You can review the most current version of the Terms of Service at any time at this page. We reserve the right, at our sole
        discretion, to update, change or replace any part of these Terms of Service by posting updates and changes to our website. It is
        your responsibility to check our website periodically for changes. Your continued use of or access to our website or the Service
        following the posting of any changes to these Terms of Service constitutes acceptance of those changes.
      </p>
      <h2>SECTION 24 - CONTACT INFORMATION</h2>
      <p className="mb-2 pl-2">
        Questions about the Terms of Service should be sent to us at{' '}
        <a className="underline" href={`mailto:${email}?subject=Question about Terms of Service`} target="_blank" rel="noreferrer">
          {email}
        </a>
        .
      </p>
      <p className="mb-2 pl-2">
        To report concerns regarding security, ethics, or compliance, contact{' '}
        <a className="underline" href="mailto:compliance@getjetstream.app" target="_blank" rel="noreferrer">
          compliance@getjetstream.app
        </a>
        . You may also submit a report anonymously using our{' '}
        <a className="underline" href="https://forms.gle/TrN2hL8m8m4Lkpfb7" target="_blank" rel="noreferrer">
          confidential reporting form
        </a>
        .
      </p>
      <h2>SECTION 25 - 3RD PARTY LICENSE INFORMATION</h2>
      <p className="mb-2 pl-2">
        License information is available upon request. The Jetstream homepage uses the following open source licenses that require
        attribution.
      </p>
      <p className="mb-2 pl-2">https://github.com/salesforce-ux/design-system/blob/master/LICENSE.txt</p>
      <p className="mb-2 pl-2">https://github.com/salesforce-ux/design-system/blob/master/LICENSE-icons-images.txt</p>
    </div>
  );
}

Page.getLayout = function getLayout(page) {
  return (
    <Layout title="Terms of Service | Jetstream" navigationProps={{ omitLinks: [ROUTES.TERMS_OF_SERVICE] }}>
      {page}
    </Layout>
  );
};
