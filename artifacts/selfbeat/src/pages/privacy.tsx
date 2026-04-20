export default function PrivacyPolicy() {
  return (
    <div className="container py-16 max-w-3xl animate-in fade-in slide-in-from-bottom-6 duration-500">
      <header className="mb-12">
        <h1 className="text-4xl font-bold font-serif mb-3">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">Last updated: April 2026</p>
      </header>

      <div className="space-y-10 text-[15px] leading-relaxed text-foreground/90">

        <section>
          <p>
            Selfbeat ("<strong>we</strong>", "<strong>us</strong>", or "<strong>our</strong>") is committed to protecting your privacy. This Privacy Policy explains what information we collect, how we use it, and what rights you have in relation to it. By using Selfbeat at <a href="https://selfbeat.ai" className="text-primary hover:underline">selfbeat.ai</a>, you agree to the practices described here.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold font-serif mb-3">1. Information We Collect</h2>
          <div className="space-y-3">
            <div>
              <p className="font-medium mb-1">Google Account Information</p>
              <p className="text-muted-foreground">When you sign in with Google we receive your name, email address, and profile picture from Google OAuth. We use this to create and identify your account.</p>
            </div>
            <div>
              <p className="font-medium mb-1">Device Fingerprint</p>
              <p className="text-muted-foreground">We collect a device fingerprint via FingerprintJS to detect and prevent abuse of free credits across multiple accounts on the same device.</p>
            </div>
            <div>
              <p className="font-medium mb-1">Usage Data</p>
              <p className="text-muted-foreground">We record the questions you ask, credits used, and your subscription status in order to provide the service and track account activity.</p>
            </div>
            <div>
              <p className="font-medium mb-1">Payment Information</p>
              <p className="text-muted-foreground">Payments are processed entirely by Stripe. We never receive or store your card details. We do receive metadata such as subscription status and payment history from Stripe.</p>
            </div>
            <div>
              <p className="font-medium mb-1">Technical Data</p>
              <p className="text-muted-foreground">We collect your IP address and browser information as part of normal server logging and for security purposes.</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold font-serif mb-3">2. How We Use Your Information</h2>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            <li>To provide, operate, and improve the Selfbeat service</li>
            <li>To manage your account and credit balance</li>
            <li>To process payments and manage subscriptions via Stripe</li>
            <li>To detect and prevent fraud and abuse of free credits</li>
            <li>To send service-related emails such as billing confirmations</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold font-serif mb-3">3. Data Storage and Security</h2>
          <p className="text-muted-foreground">
            Your data is stored securely on our servers. Payment data is handled entirely by Stripe and is never stored on our servers. We use industry-standard security measures including encrypted connections and access controls to protect your information. No method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold font-serif mb-3">4. Third-Party Services</h2>
          <div className="space-y-3">
            <div>
              <p className="font-medium mb-1">Google OAuth</p>
              <p className="text-muted-foreground">Used for authentication. Subject to <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google's Privacy Policy</a>.</p>
            </div>
            <div>
              <p className="font-medium mb-1">Stripe</p>
              <p className="text-muted-foreground">Used for payment processing. Subject to <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Stripe's Privacy Policy</a>.</p>
            </div>
            <div>
              <p className="font-medium mb-1">FingerprintJS</p>
              <p className="text-muted-foreground">Used for device identification to prevent credit abuse. Subject to <a href="https://fingerprint.com/privacy-policy/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">FingerprintJS's Privacy Policy</a>.</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold font-serif mb-3">5. Your Rights</h2>
          <p className="text-muted-foreground">
            You may request deletion of your account and all associated data at any time by emailing <a href="mailto:contact@selfbeat.ai" className="text-primary hover:underline">contact@selfbeat.ai</a>. You may also cancel your subscription at any time from your account settings. Depending on your location, you may have additional rights under applicable privacy laws.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold font-serif mb-3">6. Cookies</h2>
          <p className="text-muted-foreground">
            We use session cookies to keep you signed in across page loads. We do not use advertising or tracking cookies. FingerprintJS may use browser storage mechanisms as part of device identification.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold font-serif mb-3">7. Contact</h2>
          <p className="text-muted-foreground">
            For any privacy-related questions or requests, please contact us at <a href="mailto:contact@selfbeat.ai" className="text-primary hover:underline">contact@selfbeat.ai</a>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold font-serif mb-3">8. Governing Law</h2>
          <p className="text-muted-foreground">
            This Privacy Policy is governed by the laws of British Columbia, Canada, without regard to its conflict of law provisions.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold font-serif mb-3">9. Changes to This Policy</h2>
          <p className="text-muted-foreground">
            We may update this Privacy Policy from time to time. We will notify users of significant changes by posting a notice on the site or sending an email. Continued use of Selfbeat after changes are posted constitutes acceptance of the updated policy.
          </p>
        </section>

      </div>
    </div>
  );
}
