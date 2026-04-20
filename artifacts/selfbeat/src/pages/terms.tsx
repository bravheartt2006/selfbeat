export default function TermsOfService() {
  return (
    <div className="container py-16 max-w-3xl animate-in fade-in slide-in-from-bottom-6 duration-500">
      <header className="mb-12">
        <h1 className="text-4xl font-bold font-serif mb-3">Terms of Service</h1>
        <p className="text-sm text-muted-foreground">Last updated: April 2026</p>
      </header>

      <div className="space-y-10 text-[15px] leading-relaxed text-foreground/90">

        <section>
          <p>
            These Terms of Service govern your use of Selfbeat at <a href="https://selfbeat.ai" className="text-primary hover:underline">selfbeat.ai</a> (the "<strong>Service</strong>"), operated by Selfbeat ("<strong>we</strong>", "<strong>us</strong>", or "<strong>our</strong>"). By accessing or using the Service, you agree to be bound by these Terms. If you do not agree, please do not use Selfbeat.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold font-serif mb-3">1. Acceptance of Terms</h2>
          <p className="text-muted-foreground">
            By using Selfbeat you confirm that you have read, understood, and agree to these Terms of Service. You must be at least 13 years old to create an account and use the Service. If you are under 18, you represent that a parent or guardian has reviewed and agreed to these Terms on your behalf.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold font-serif mb-3">2. Description of Service</h2>
          <p className="text-muted-foreground">
            Selfbeat is an AI comparison and evaluation platform. It submits your questions to multiple AI models simultaneously, collects their answers, prompts each model to self-critique its own response, and produces a final scored verdict. All results are provided for informational purposes only and should not be relied upon as professional advice.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold font-serif mb-3">3. User Accounts</h2>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            <li>You must sign in with Google to access the Service.</li>
            <li>You are responsible for maintaining the security of your account.</li>
            <li>One account per person. Creating multiple accounts to obtain additional free credits is a violation of these Terms and may result in account suspension.</li>
            <li>You agree to provide accurate information and keep your account details up to date.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold font-serif mb-3">4. Credits and Payments</h2>
          <div className="space-y-3 text-muted-foreground">
            <p>New users receive <strong className="text-foreground">25 free credits</strong> on signup — no credit card required. Each question you submit consumes one credit.</p>
            <p>Purchased credits do not expire. The following paid plans are available:</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li><strong className="text-foreground">Starter Pack</strong> — $4.99 for 25 additional credits (one-time purchase)</li>
              <li><strong className="text-foreground">Pro Monthly</strong> — $14.99 per month for unlimited comparisons</li>
              <li><strong className="text-foreground">Pro Annual</strong> — $99 per year for unlimited comparisons</li>
              <li><strong className="text-foreground">Team Plan</strong> — $49 per month for up to 5 team members with unlimited comparisons</li>
            </ul>
            <p>All payments are processed securely by Stripe. By completing a purchase you also agree to <a href="https://stripe.com/legal" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Stripe's Terms of Service</a>.</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold font-serif mb-3">5. Refund Policy</h2>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            <li>Unused credits from one-time Starter Pack purchases are non-refundable.</li>
            <li>Monthly and annual subscriptions can be cancelled at any time from your account settings.</li>
            <li>Cancellation takes effect at the end of the current billing period. No partial refunds are issued for unused portions of a subscription period.</li>
            <li>For any billing issues or disputes, contact us at <a href="mailto:contact@selfbeat.ai" className="text-primary hover:underline">contact@selfbeat.ai</a>.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold font-serif mb-3">6. Prohibited Uses</h2>
          <p className="text-muted-foreground mb-2">You agree not to:</p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            <li>Create multiple accounts to obtain additional free credits</li>
            <li>Use automated tools, bots, or scripts to interact with the Service</li>
            <li>Resell, redistribute, or sublicense access to Selfbeat or its output</li>
            <li>Use the Service for any unlawful purpose or in violation of any applicable law</li>
            <li>Attempt to interfere with, disrupt, or compromise the security of the Service</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold font-serif mb-3">7. Intellectual Property</h2>
          <p className="text-muted-foreground">
            The Selfbeat name, logo, design, and platform are owned by Selfbeat. AI-generated responses are produced by third-party AI providers and remain subject to those providers' terms. You may share Selfbeat results freely with attribution to <span className="text-foreground font-medium">selfbeat.ai</span>, but may not reproduce or redistribute Selfbeat's interface or platform.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold font-serif mb-3">8. Disclaimer</h2>
          <p className="text-muted-foreground">
            Selfbeat is provided on an "as is" and "as available" basis. AI responses are generated by third-party models and are for informational purposes only. They should not be relied upon for medical, legal, financial, or other professional decisions. We do not guarantee the accuracy, completeness, or reliability of any AI response. Always consult a qualified professional for advice specific to your situation.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold font-serif mb-3">9. Limitation of Liability</h2>
          <p className="text-muted-foreground">
            To the fullest extent permitted by applicable law, Selfbeat and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or related to your use of the Service. Our total liability to you for any claim arising from these Terms or the Service shall not exceed the amount you paid to us in the 30 days preceding the claim.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold font-serif mb-3">10. Governing Law</h2>
          <p className="text-muted-foreground">
            These Terms are governed by the laws of British Columbia, Canada, without regard to conflict of law principles. Any disputes arising under these Terms shall be resolved exclusively in the courts of British Columbia, Canada.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold font-serif mb-3">11. Contact</h2>
          <p className="text-muted-foreground">
            For any questions about these Terms, please contact us at <a href="mailto:contact@selfbeat.ai" className="text-primary hover:underline">contact@selfbeat.ai</a>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold font-serif mb-3">12. Changes to These Terms</h2>
          <p className="text-muted-foreground">
            We may update these Terms of Service from time to time. We will notify users of significant changes by posting a notice on the site or sending an email. Continued use of the Service after changes are posted constitutes acceptance of the updated Terms.
          </p>
        </section>

      </div>
    </div>
  );
}
