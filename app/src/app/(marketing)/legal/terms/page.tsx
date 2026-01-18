import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service - Hissuno',
  description: 'Terms of Service for Hissuno - AI-powered customer intelligence platform.',
}

export default function TermsOfServicePage() {
  return (
    <article className="mx-auto max-w-4xl px-6 py-24 md:px-12">
      <header className="mb-12">
        <h1 className="font-mono text-4xl font-bold text-[var(--foreground)]">Terms of Service</h1>
        <p className="mt-4 text-[var(--text-secondary)]">Last updated: January 12, 2025</p>
      </header>

      <div className="prose prose-slate max-w-none dark:prose-invert prose-headings:font-mono prose-headings:font-semibold prose-h2:text-2xl prose-h3:text-xl prose-p:text-[var(--text-secondary)] prose-li:text-[var(--text-secondary)] prose-strong:text-[var(--foreground)]">
        <section className="mb-10">
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using the Hissuno platform (&quot;Service&quot;), you agree to be bound by
            these Terms of Service (&quot;Terms&quot;). If you disagree with any part of the terms, you
            may not access the Service.
          </p>
          <p>
            These Terms apply to all visitors, users, and others who access or use the Service. By
            using the Service, you represent that you are at least 18 years of age and have the
            legal capacity to enter into these Terms.
          </p>
        </section>

        <section className="mb-10">
          <h2>2. Description of Service</h2>
          <p>
            Hissuno is an AI-powered customer intelligence platform that converts customer
            conversations into actionable engineering work. The Service includes features such as:
          </p>
          <ul>
            <li>AI-powered support agents</li>
            <li>Customer conversation analysis</li>
            <li>Automated issue creation and triage</li>
            <li>Product specification generation</li>
            <li>Integration with third-party tools (Slack, GitHub, Jira, Linear, etc.)</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2>3. Account Registration</h2>
          <p>
            To use certain features of the Service, you must register for an account. When you
            register, you agree to:
          </p>
          <ul>
            <li>Provide accurate, current, and complete information</li>
            <li>Maintain and promptly update your account information</li>
            <li>
              Maintain the security of your password and accept responsibility for all activities
              under your account
            </li>
            <li>
              Notify us immediately of any unauthorized use of your account or any other breach of
              security
            </li>
          </ul>
        </section>

        <section className="mb-10">
          <h2>4. Subscription and Billing</h2>
          <h3>4.1 Subscription Plans</h3>
          <p>
            The Service is offered on a subscription basis. We offer various subscription plans with
            different features and pricing. Details of available plans are provided on our pricing
            page.
          </p>

          <h3>4.2 Billing</h3>
          <p>
            Paid subscriptions are billed in advance on a monthly or annual basis. Subscriptions
            automatically renew at the end of each billing cycle unless cancelled before the renewal
            date.
          </p>

          <h3>4.3 Payment</h3>
          <p>
            You agree to pay all fees associated with your subscription plan. All fees are
            non-refundable except as expressly set forth in these Terms or as required by applicable
            law.
          </p>

          <h3>4.4 Price Changes</h3>
          <p>
            We reserve the right to modify our pricing with at least 30 days&apos; notice. Price
            changes will take effect at the start of the next billing cycle.
          </p>
        </section>

        <section className="mb-10">
          <h2>5. User Content</h2>
          <h3>5.1 Ownership</h3>
          <p>
            You retain ownership of all content you submit, post, or display through the Service
            (&quot;User Content&quot;). By submitting User Content, you grant Hissuno a worldwide,
            non-exclusive, royalty-free license to use, process, and analyze such content solely for
            the purpose of providing the Service.
          </p>

          <h3>5.2 Responsibility</h3>
          <p>
            You are solely responsible for your User Content and the consequences of posting or
            publishing it. You represent and warrant that you have all rights necessary to grant the
            licenses in these Terms.
          </p>

          <h3>5.3 Data Processing</h3>
          <p>
            The Service uses artificial intelligence to analyze and process User Content. By using
            the Service, you consent to this processing. We do not use your User Content to train
            our AI models without your explicit consent.
          </p>
        </section>

        <section className="mb-10">
          <h2>6. Intellectual Property</h2>
          <p>
            The Service, including all software, algorithms, designs, text, graphics, logos, and
            other content (excluding User Content), is owned by Hissuno and is protected by
            copyright, trademark, and other intellectual property laws.
          </p>
          <p>
            Subject to your compliance with these Terms, Hissuno grants you a limited, non-exclusive,
            non-transferable license to access and use the Service for your internal business
            purposes.
          </p>
        </section>

        <section className="mb-10">
          <h2>7. Acceptable Use</h2>
          <p>You agree not to use the Service to:</p>
          <ul>
            <li>Violate any applicable laws or regulations</li>
            <li>Infringe upon the rights of others</li>
            <li>Upload or transmit malware, viruses, or other malicious code</li>
            <li>Attempt to gain unauthorized access to the Service or its related systems</li>
            <li>Interfere with or disrupt the Service or servers</li>
            <li>Engage in any activity that could damage, disable, or impair the Service</li>
            <li>Use the Service for any illegal or unauthorized purpose</li>
            <li>Scrape, data mine, or use automated tools to access the Service</li>
            <li>Resell or redistribute the Service without authorization</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2>8. Third-Party Integrations</h2>
          <p>
            The Service may integrate with third-party services (e.g., Slack, GitHub, Jira, Linear).
            Your use of such integrations is subject to the terms and policies of those third-party
            services. We are not responsible for the content, privacy policies, or practices of
            third-party services.
          </p>
        </section>

        <section className="mb-10">
          <h2>9. Termination</h2>
          <h3>9.1 Termination by You</h3>
          <p>
            You may cancel your subscription at any time through your account settings. Upon
            cancellation, your subscription will remain active until the end of the current billing
            period.
          </p>

          <h3>9.2 Termination by Us</h3>
          <p>
            We may terminate or suspend your account immediately, without prior notice, for any
            reason, including breach of these Terms. Upon termination, your right to use the Service
            will immediately cease.
          </p>

          <h3>9.3 Effect of Termination</h3>
          <p>
            Upon termination, we may delete your User Content. We recommend exporting your data
            before cancelling your account. Sections of these Terms that by their nature should
            survive termination will survive.
          </p>
        </section>

        <section className="mb-10">
          <h2>10. Disclaimer of Warranties</h2>
          <p>
            THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT
            WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED
            WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
          </p>
          <p>
            We do not warrant that the Service will be uninterrupted, secure, or error-free. The
            AI-generated content and analysis provided by the Service may contain errors and should
            not be relied upon as the sole basis for important decisions.
          </p>
        </section>

        <section className="mb-10">
          <h2>11. Limitation of Liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, HISSUNO SHALL NOT BE LIABLE FOR ANY INDIRECT,
            INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR
            REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL,
            OR OTHER INTANGIBLE LOSSES.
          </p>
          <p>
            IN NO EVENT SHALL HISSUNO&apos;S TOTAL LIABILITY EXCEED THE AMOUNTS PAID BY YOU TO
            HISSUNO DURING THE TWELVE (12) MONTHS PRIOR TO THE CLAIM.
          </p>
        </section>

        <section className="mb-10">
          <h2>12. Indemnification</h2>
          <p>
            You agree to indemnify, defend, and hold harmless Hissuno and its officers, directors,
            employees, and agents from any claims, damages, losses, liabilities, and expenses
            (including reasonable attorneys&apos; fees) arising out of or related to your use of the
            Service, your User Content, or your violation of these Terms.
          </p>
        </section>

        <section className="mb-10">
          <h2>13. Changes to Terms</h2>
          <p>
            We reserve the right to modify these Terms at any time. We will provide notice of
            material changes by posting the updated Terms on this page and updating the &quot;Last
            updated&quot; date. Your continued use of the Service after such changes constitutes
            acceptance of the new Terms.
          </p>
        </section>

        <section className="mb-10">
          <h2>14. Governing Law</h2>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of the State
            of Delaware, United States, without regard to its conflict of law provisions.
          </p>
        </section>

        <section className="mb-10">
          <h2>15. Dispute Resolution</h2>
          <p>
            Any disputes arising out of or relating to these Terms or the Service shall be resolved
            through binding arbitration in accordance with the rules of the American Arbitration
            Association. The arbitration shall take place in Delaware, United States.
          </p>
          <p>
            You agree to waive any right to participate in a class action lawsuit or class-wide
            arbitration against Hissuno.
          </p>
        </section>

        <section className="mb-10">
          <h2>16. Severability</h2>
          <p>
            If any provision of these Terms is found to be unenforceable or invalid, that provision
            will be limited or eliminated to the minimum extent necessary so that these Terms will
            otherwise remain in full force and effect.
          </p>
        </section>

        <section className="mb-10">
          <h2>17. Entire Agreement</h2>
          <p>
            These Terms, together with our Privacy Policy, constitute the entire agreement between
            you and Hissuno regarding the Service and supersede all prior agreements and
            understandings.
          </p>
        </section>

        <section className="mb-10">
          <h2>18. Contact Us</h2>
          <p>If you have any questions about these Terms, please contact us at:</p>
          <p>
            <strong>Email:</strong> legal@hissuno.com
          </p>
        </section>
      </div>
    </article>
  )
}
