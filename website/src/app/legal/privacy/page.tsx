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
        <p className="mt-4 text-[var(--text-secondary)]">Last updated: March 29, 2026</p>
      </header>

      <div className="prose prose-slate max-w-none dark:prose-invert prose-headings:font-mono prose-headings:font-semibold prose-h2:text-2xl prose-h3:text-xl prose-p:text-[var(--text-secondary)] prose-li:text-[var(--text-secondary)] prose-strong:text-[var(--foreground)]">
        <section className="mb-10">
          <h2>1. Introduction</h2>
          <p>
            Hissuno (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting
            your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard
            your information when you visit the Hissuno website at hissuno.com (the
            &quot;Website&quot;).
          </p>
          <p>
            Hissuno is open source software. This Privacy Policy applies only to the Website and any
            services we operate directly. It does not apply to self-hosted instances of Hissuno,
            which are entirely under the control of whoever deploys them.
          </p>
        </section>

        <section className="mb-10">
          <h2>2. Self-Hosted Instances</h2>
          <p>
            When you self-host Hissuno, all data - including customer conversations, feedback,
            knowledge sources, and user accounts - is stored in your own infrastructure. We have no
            access to, visibility into, or control over data in self-hosted deployments.
          </p>
          <p>
            If you operate a self-hosted instance, you are the data controller and are responsible for
            your own privacy practices, including compliance with applicable data protection laws.
          </p>
          <p>
            Self-hosted instances may connect to third-party services (such as OpenAI, Slack, or
            GitHub) that have their own privacy practices. Please review the privacy policies of any
            services you connect to your deployment.
          </p>
        </section>

        <section className="mb-10">
          <h2>3. Information We Collect</h2>

          <h3>3.1 Information You Provide</h3>
          <ul>
            <li>
              <strong>Account Information:</strong> Name, email address, and company name if you
              create an account on the Website.
            </li>
            <li>
              <strong>Communications:</strong> Information you provide when you contact us for
              support, report issues, or contribute to the project.
            </li>
          </ul>

          <h3>3.2 Information Collected Automatically</h3>
          <ul>
            <li>
              <strong>Usage Data:</strong> Information about how you interact with the Website,
              including pages visited and actions taken.
            </li>
            <li>
              <strong>Device Information:</strong> Browser type, operating system, and IP address.
            </li>
            <li>
              <strong>Cookies:</strong> We use cookies and similar technologies to enhance your
              experience on the Website.
            </li>
          </ul>
        </section>

        <section className="mb-10">
          <h2>4. How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul>
            <li>Operate and improve the Website</li>
            <li>Respond to your comments, questions, and support requests</li>
            <li>Send technical notices, security alerts, and project updates</li>
            <li>Monitor and analyze usage trends on the Website</li>
            <li>Detect and prevent fraudulent or unauthorized activities</li>
            <li>Comply with legal obligations</li>
          </ul>
          <p>
            We do not collect, access, or process any data from self-hosted Hissuno instances.
          </p>
        </section>

        <section className="mb-10">
          <h2>5. AI Processing</h2>
          <p>
            The Hissuno software uses third-party AI services (such as OpenAI) to process data. When
            self-hosting, your data is sent directly from your infrastructure to these AI providers
            based on your own configuration. We are not involved in this data flow.
          </p>
          <p>
            We do not use any user data or self-hosted instance data to train AI models.
          </p>
        </section>

        <section className="mb-10">
          <h2>6. Data Sharing and Disclosure</h2>
          <p>We may share information collected through the Website in the following cases:</p>

          <h3>6.1 Service Providers</h3>
          <p>
            We may use third-party services for website hosting, analytics, and email delivery. These
            providers process data on our behalf.
          </p>

          <h3>6.2 Legal Requirements</h3>
          <p>
            We may disclose information if required by law, regulation, legal process, or
            governmental request.
          </p>

          <h3>6.3 With Your Consent</h3>
          <p>We may share information with your consent or at your direction.</p>
        </section>

        <section className="mb-10">
          <h2>7. Data Security</h2>
          <p>
            We implement reasonable technical and organizational measures to protect information
            collected through the Website. However, no method of transmission over the Internet or
            electronic storage is 100% secure.
          </p>
        </section>

        <section className="mb-10">
          <h2>8. Data Retention</h2>
          <p>
            We retain information collected through the Website for as long as necessary to fulfill
            the purposes described in this policy. You may request deletion of your information by
            contacting us.
          </p>
        </section>

        <section className="mb-10">
          <h2>9. Your Rights</h2>
          <p>Depending on your location, you may have the right to:</p>
          <ul>
            <li>Access and receive a copy of your personal data</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your personal data</li>
            <li>Object to or restrict processing of your data</li>
            <li>Data portability</li>
            <li>Opt out of marketing communications</li>
          </ul>
          <p>
            To exercise any of these rights, contact us at privacy@hissuno.com. We do not sell
            personal information.
          </p>
        </section>

        <section className="mb-10">
          <h2>10. Children&apos;s Privacy</h2>
          <p>
            The Website is not intended for children under 18 years of age. We do not knowingly
            collect personal information from children. If we learn we have collected information
            from a child, we will delete it promptly.
          </p>
        </section>

        <section className="mb-10">
          <h2>11. Third-Party Links</h2>
          <p>
            The Website may contain links to third-party websites or services. We are not
            responsible for the privacy practices of these third parties.
          </p>
        </section>

        <section className="mb-10">
          <h2>12. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will provide notice of material
            changes by posting the new policy on this page and updating the &quot;Last updated&quot;
            date. Your continued use of the Website after changes constitutes acceptance of the
            updated policy.
          </p>
        </section>

        <section className="mb-10">
          <h2>13. Contact Us</h2>
          <p>
            If you have questions or concerns about this Privacy Policy, please contact us at:
          </p>
          <p>
            <strong>Email:</strong> privacy@hissuno.com
          </p>
        </section>
      </div>
    </article>
  )
}
