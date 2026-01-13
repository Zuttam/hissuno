import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy - Hissuno',
  description: 'Privacy Policy for Hissuno - Learn how we collect, use, and protect your data.',
}

export default function PrivacyPolicyPage() {
  return (
    <article className="mx-auto max-w-4xl px-6 py-24 md:px-12">
      <header className="mb-12">
        <h1 className="font-mono text-4xl font-bold text-[var(--foreground)]">Privacy Policy</h1>
        <p className="mt-4 text-[var(--text-secondary)]">Last updated: January 12, 2025</p>
      </header>

      <div className="prose prose-slate max-w-none dark:prose-invert prose-headings:font-mono prose-headings:font-semibold prose-h2:text-2xl prose-h3:text-xl prose-p:text-[var(--text-secondary)] prose-li:text-[var(--text-secondary)] prose-strong:text-[var(--foreground)]">
        <section className="mb-10">
          <h2>1. Introduction</h2>
          <p>
            Hissuno (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting
            your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard
            your information when you use our AI-powered customer intelligence platform (the
            &quot;Service&quot;).
          </p>
          <p>
            Please read this Privacy Policy carefully. By using the Service, you consent to the
            practices described in this policy.
          </p>
        </section>

        <section className="mb-10">
          <h2>2. Information We Collect</h2>

          <h3>2.1 Information You Provide</h3>
          <ul>
            <li>
              <strong>Account Information:</strong> Name, email address, company name, and password
              when you create an account.
            </li>
            <li>
              <strong>Payment Information:</strong> Billing address and payment details processed
              through our secure payment processor.
            </li>
            <li>
              <strong>User Content:</strong> Customer conversations, support tickets, feedback, and
              other data you upload to the Service.
            </li>
            <li>
              <strong>Communications:</strong> Information you provide when you contact us for
              support or feedback.
            </li>
          </ul>

          <h3>2.2 Information Collected Automatically</h3>
          <ul>
            <li>
              <strong>Usage Data:</strong> Information about how you interact with the Service,
              including pages visited, features used, and actions taken.
            </li>
            <li>
              <strong>Device Information:</strong> Browser type, operating system, device
              identifiers, and IP address.
            </li>
            <li>
              <strong>Cookies and Tracking:</strong> We use cookies and similar technologies to
              enhance your experience and collect usage data.
            </li>
          </ul>

          <h3>2.3 Information from Third Parties</h3>
          <p>
            When you connect third-party services (such as Slack, GitHub, Jira, or Linear), we may
            receive information from those services as authorized by you.
          </p>
        </section>

        <section className="mb-10">
          <h2>3. How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul>
            <li>Provide, maintain, and improve the Service</li>
            <li>Process transactions and send related information</li>
            <li>Analyze customer conversations and generate insights using AI</li>
            <li>Create automated issues, product specs, and recommendations</li>
            <li>Send technical notices, updates, security alerts, and support messages</li>
            <li>Respond to your comments, questions, and customer service requests</li>
            <li>Monitor and analyze trends, usage, and activities</li>
            <li>Detect, investigate, and prevent fraudulent or unauthorized activities</li>
            <li>Personalize and improve your experience</li>
            <li>Comply with legal obligations</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2>4. AI Processing</h2>
          <p>
            Our Service uses artificial intelligence to analyze and process your User Content. This
            processing includes:
          </p>
          <ul>
            <li>Natural language processing of customer conversations</li>
            <li>Automatic classification and tagging of support requests</li>
            <li>Generation of product specifications and issue summaries</li>
            <li>Pattern recognition and trend analysis</li>
          </ul>
          <p>
            <strong>Important:</strong> We do not use your User Content to train our AI models
            without your explicit consent. Your data is processed solely to provide the Service to
            you.
          </p>
        </section>

        <section className="mb-10">
          <h2>5. Data Sharing and Disclosure</h2>
          <p>We may share your information in the following circumstances:</p>

          <h3>5.1 Service Providers</h3>
          <p>
            We may share information with third-party vendors who perform services on our behalf,
            such as hosting, payment processing, analytics, and customer support.
          </p>

          <h3>5.2 Third-Party Integrations</h3>
          <p>
            When you connect third-party services, information may be shared with those services as
            necessary to enable the integration.
          </p>

          <h3>5.3 Legal Requirements</h3>
          <p>
            We may disclose information if required by law, regulation, legal process, or
            governmental request.
          </p>

          <h3>5.4 Business Transfers</h3>
          <p>
            In connection with a merger, acquisition, or sale of assets, your information may be
            transferred to the acquiring entity.
          </p>

          <h3>5.5 With Your Consent</h3>
          <p>We may share information with your consent or at your direction.</p>
        </section>

        <section className="mb-10">
          <h2>6. Data Security</h2>
          <p>
            We implement appropriate technical and organizational measures to protect your
            information, including:
          </p>
          <ul>
            <li>Encryption of data in transit and at rest</li>
            <li>Regular security assessments and audits</li>
            <li>Access controls and authentication mechanisms</li>
            <li>Employee training on data protection</li>
            <li>Incident response procedures</li>
          </ul>
          <p>
            However, no method of transmission over the Internet or electronic storage is 100%
            secure. We cannot guarantee absolute security.
          </p>
        </section>

        <section className="mb-10">
          <h2>7. Data Retention</h2>
          <p>
            We retain your information for as long as your account is active or as needed to provide
            the Service. We may also retain information as necessary to comply with legal
            obligations, resolve disputes, and enforce agreements.
          </p>
          <p>
            Upon account deletion, we will delete or anonymize your personal information within 30
            days, except where retention is required by law.
          </p>
        </section>

        <section className="mb-10">
          <h2>8. Your Rights and Choices</h2>
          <p>Depending on your location, you may have the following rights:</p>

          <h3>8.1 Access and Portability</h3>
          <p>
            You can access and export your data through your account settings or by contacting us.
          </p>

          <h3>8.2 Correction</h3>
          <p>You can update your account information at any time through your account settings.</p>

          <h3>8.3 Deletion</h3>
          <p>
            You can request deletion of your account and personal data by contacting us or through
            your account settings.
          </p>

          <h3>8.4 Opt-Out</h3>
          <p>
            You can opt out of marketing communications by following the unsubscribe instructions in
            our emails or by contacting us.
          </p>

          <h3>8.5 Cookies</h3>
          <p>
            Most browsers allow you to control cookies through their settings. Note that disabling
            cookies may affect the functionality of the Service.
          </p>
        </section>

        <section className="mb-10">
          <h2>9. International Data Transfers</h2>
          <p>
            Your information may be transferred to and processed in countries other than your own.
            We ensure appropriate safeguards are in place to protect your information in accordance
            with applicable law.
          </p>
        </section>

        <section className="mb-10">
          <h2>10. Children&apos;s Privacy</h2>
          <p>
            The Service is not intended for children under 18 years of age. We do not knowingly
            collect personal information from children. If we learn we have collected information
            from a child, we will delete it promptly.
          </p>
        </section>

        <section className="mb-10">
          <h2>11. California Privacy Rights</h2>
          <p>
            If you are a California resident, you have additional rights under the California
            Consumer Privacy Act (CCPA), including:
          </p>
          <ul>
            <li>The right to know what personal information we collect</li>
            <li>The right to request deletion of your personal information</li>
            <li>The right to opt-out of the sale of personal information</li>
            <li>The right to non-discrimination for exercising your rights</li>
          </ul>
          <p>We do not sell personal information as defined under the CCPA.</p>
        </section>

        <section className="mb-10">
          <h2>12. European Privacy Rights</h2>
          <p>
            If you are located in the European Economic Area (EEA), you have rights under the
            General Data Protection Regulation (GDPR), including:
          </p>
          <ul>
            <li>The right to access your personal data</li>
            <li>The right to rectification of inaccurate data</li>
            <li>The right to erasure (&quot;right to be forgotten&quot;)</li>
            <li>The right to restrict processing</li>
            <li>The right to data portability</li>
            <li>The right to object to processing</li>
            <li>Rights related to automated decision-making</li>
          </ul>
          <p>
            Our legal basis for processing personal data includes: performance of a contract,
            legitimate interests, consent, and compliance with legal obligations.
          </p>
        </section>

        <section className="mb-10">
          <h2>13. Third-Party Links</h2>
          <p>
            The Service may contain links to third-party websites or services. We are not
            responsible for the privacy practices of these third parties. We encourage you to review
            their privacy policies.
          </p>
        </section>

        <section className="mb-10">
          <h2>14. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of material
            changes by posting the new policy on this page and updating the &quot;Last updated&quot;
            date. Your continued use of the Service after changes constitutes acceptance of the
            updated policy.
          </p>
        </section>

        <section className="mb-10">
          <h2>15. Contact Us</h2>
          <p>
            If you have questions or concerns about this Privacy Policy or our data practices,
            please contact us at:
          </p>
          <p>
            <strong>Email:</strong> privacy@hissuno.com
          </p>
          <p>
            <strong>Data Protection Officer:</strong> dpo@hissuno.com
          </p>
        </section>
      </div>
    </article>
  )
}
