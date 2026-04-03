import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service - Hissuno',
  description: 'Terms of Service for Hissuno - the unified context layer for product agents.',
}

export default function TermsOfServicePage() {
  return (
    <article className="mx-auto max-w-4xl px-6 py-24 md:px-12">
      <header className="mb-12">
        <h1 className="font-mono text-4xl font-bold text-[var(--foreground)]">Terms of Service</h1>
        <p className="mt-4 text-[var(--text-secondary)]">Last updated: March 29, 2026</p>
      </header>

      <div className="prose prose-slate max-w-none dark:prose-invert prose-headings:font-mono prose-headings:font-semibold prose-h2:text-2xl prose-h3:text-xl prose-p:text-[var(--text-secondary)] prose-li:text-[var(--text-secondary)] prose-strong:text-[var(--foreground)]">
        <section className="mb-10">
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using the Hissuno website at hissuno.com (&quot;Website&quot;) or the
            Hissuno open source software (&quot;Software&quot;), you agree to be bound by these Terms
            of Service (&quot;Terms&quot;). If you disagree with any part of the terms, you may not
            access the Website or use the Software.
          </p>
          <p>
            These Terms apply to all visitors, users, and contributors. By using the Website or
            Software, you represent that you are at least 18 years of age and have the legal capacity
            to enter into these Terms.
          </p>
        </section>

        <section className="mb-10">
          <h2>2. Open Source License</h2>
          <p>
            Hissuno is open source software released under the MIT License. Your use, modification,
            and distribution of the Software is governed by the terms of the MIT License, which can
            be found in the LICENSE file in the project repository.
          </p>
          <p>
            These Terms govern your use of the Hissuno Website and any services provided through
            hissuno.com. They do not restrict any rights granted to you under the MIT License with
            respect to the Software itself.
          </p>
        </section>

        <section className="mb-10">
          <h2>3. Description of the Software</h2>
          <p>
            Hissuno is a unified context layer for product agents - an open source platform that
            ingests customer data and product knowledge from multiple sources into an interconnected
            knowledge graph. The Software includes features such as:
          </p>
          <ul>
            <li>AI-powered support and product agents</li>
            <li>Customer conversation analysis and feedback triage</li>
            <li>Automated issue creation, prioritization, and tracking</li>
            <li>Knowledge graph with semantic search</li>
            <li>Integration with third-party tools (Slack, GitHub, Jira, Linear, Intercom, etc.)</li>
            <li>MCP server for agent-native access</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2>4. Self-Hosted Deployments</h2>
          <p>
            When you self-host Hissuno, you are solely responsible for your deployment, including
            infrastructure, data storage, security, backups, and compliance with applicable laws. We
            do not have access to or control over self-hosted instances or any data processed by
            them.
          </p>
          <p>
            Self-hosted deployments may connect to third-party services (such as OpenAI for AI
            processing, or integration providers). Your use of those services is governed by their
            respective terms and policies.
          </p>
        </section>

        <section className="mb-10">
          <h2>5. Website and Account</h2>
          <h3>5.1 Account Registration</h3>
          <p>
            Certain features on the Hissuno Website may require you to create an account. When you
            register, you agree to provide accurate information and maintain the security of your
            credentials.
          </p>

          <h3>5.2 Website Content</h3>
          <p>
            The Hissuno Website, including documentation, marketing content, logos, and trademarks,
            is owned by Hissuno and protected by intellectual property laws. The &quot;Hissuno&quot;
            name and logo are trademarks of Hissuno and may not be used to endorse or promote
            derivative products without prior written permission.
          </p>
        </section>

        <section className="mb-10">
          <h2>6. Contributions</h2>
          <p>
            By submitting code, documentation, or other contributions to the Hissuno project, you
            agree that your contributions are licensed under the same MIT License as the project. You
            represent that you have the right to make such contributions and that they do not infringe
            on any third-party rights.
          </p>
        </section>

        <section className="mb-10">
          <h2>7. Acceptable Use</h2>
          <p>When using the Hissuno Website, you agree not to:</p>
          <ul>
            <li>Violate any applicable laws or regulations</li>
            <li>Infringe upon the rights of others</li>
            <li>Upload or transmit malware, viruses, or other malicious code</li>
            <li>Attempt to gain unauthorized access to the Website or its systems</li>
            <li>Interfere with or disrupt the Website or its infrastructure</li>
            <li>Misrepresent your affiliation with the Hissuno project</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2>8. Third-Party Services</h2>
          <p>
            The Software integrates with third-party services (e.g., Slack, GitHub, Jira, Linear,
            Intercom, OpenAI). Your use of such integrations is subject to the terms and policies of
            those third-party services. Hissuno is not responsible for the content, privacy
            policies, or practices of third-party services.
          </p>
        </section>

        <section className="mb-10">
          <h2>9. Disclaimer of Warranties</h2>
          <p>
            THE SOFTWARE AND WEBSITE ARE PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot;
            WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO
            IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
            NON-INFRINGEMENT.
          </p>
          <p>
            AI-generated content and analysis produced by the Software may contain errors and should
            not be relied upon as the sole basis for important decisions. We do not warrant that the
            Software will be error-free or that any defects will be corrected.
          </p>
        </section>

        <section className="mb-10">
          <h2>10. Limitation of Liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, HISSUNO AND ITS MAINTAINERS SHALL NOT BE LIABLE
            FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS
            OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA,
            USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM YOUR USE OF THE SOFTWARE OR
            WEBSITE.
          </p>
        </section>

        <section className="mb-10">
          <h2>11. Changes to Terms</h2>
          <p>
            We reserve the right to modify these Terms at any time. We will provide notice of
            material changes by posting the updated Terms on this page and updating the &quot;Last
            updated&quot; date. Your continued use of the Website after such changes constitutes
            acceptance of the new Terms.
          </p>
        </section>

        <section className="mb-10">
          <h2>12. Governing Law</h2>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of the State
            of Delaware, United States, without regard to its conflict of law provisions.
          </p>
        </section>

        <section className="mb-10">
          <h2>13. Severability</h2>
          <p>
            If any provision of these Terms is found to be unenforceable or invalid, that provision
            will be limited or eliminated to the minimum extent necessary so that these Terms will
            otherwise remain in full force and effect.
          </p>
        </section>

        <section className="mb-10">
          <h2>14. Entire Agreement</h2>
          <p>
            These Terms, together with the MIT License and our Privacy Policy, constitute the entire
            agreement between you and Hissuno regarding the Website and Software, and supersede all
            prior agreements and understandings.
          </p>
        </section>

        <section className="mb-10">
          <h2>15. Contact Us</h2>
          <p>If you have any questions about these Terms, please contact us at:</p>
          <p>
            <strong>Email:</strong> legal@hissuno.com
          </p>
        </section>
      </div>
    </article>
  )
}
