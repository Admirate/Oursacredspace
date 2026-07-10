import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <section className="min-h-[60vh] bg-sacred-cream">
      <div className="container py-16 md:py-24 max-w-4xl">
        <h1 className="text-3xl md:text-4xl font-light text-sacred-burgundy mb-2">
          Privacy Policy
        </h1>
        <p className="text-sm text-sacred-burgundy/60 mb-10">
          Last updated: 28 May 2025
        </p>

        <div className="space-y-10 text-sacred-burgundy/80 text-sm leading-relaxed">
          {/* Introduction */}
          <div>
            <h2 className="text-lg font-semibold text-sacred-burgundy mb-3">
              1. Introduction
            </h2>
            <p>
              Our Sacred Space (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) operates the website{" "}
              <Link href="/" className="text-sacred-green hover:underline">
                www.oursacredspace.in
              </Link>{" "}
              and provides classes, events, workshops, co-working spaces, and related
              services. This Privacy Policy explains how we collect, use, disclose,
              and safeguard your personal information when you visit our website or
              use our services.
            </p>
            <p className="mt-3">
              By using our website or services, you consent to the practices
              described in this policy. If you do not agree, please refrain from
              using our website.
            </p>
          </div>

          {/* Information We Collect */}
          <div>
            <h2 className="text-lg font-semibold text-sacred-burgundy mb-3">
              2. Information We Collect
            </h2>
            <h3 className="font-medium text-sacred-burgundy mb-2">
              2.1 Information You Provide
            </h3>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>
                <strong>Booking &amp; Registration:</strong> Name, email address, phone
                number when you book a class, event, or space.
              </li>
              <li>
                <strong>Contact Enquiries:</strong> Name, email, phone number, and
                message content when you submit a contact or space enquiry form.
              </li>
              <li>
                <strong>Payment Information:</strong> Payment details are processed
                securely by our payment partner, Razorpay. We do not store your
                card details on our servers.
              </li>
            </ul>

            <h3 className="font-medium text-sacred-burgundy mt-4 mb-2">
              2.2 Information Collected Automatically
            </h3>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>
                <strong>Usage Data:</strong> Pages visited, time spent, browser type,
                device information, and IP address.
              </li>
              <li>
                <strong>Cookies:</strong> We use essential cookies for website
                functionality and session management. We do not use third-party
                advertising cookies.
              </li>
              <li>
                <strong>Error Tracking:</strong> We use Sentry for error monitoring to
                improve website reliability. This may capture anonymised technical
                data about errors encountered during your visit.
              </li>
            </ul>
          </div>

          {/* How We Use Your Information */}
          <div>
            <h2 className="text-lg font-semibold text-sacred-burgundy mb-3">
              3. How We Use Your Information
            </h2>
            <p className="mb-3">We use the information we collect to:</p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>Process and confirm your bookings for classes, events, and spaces.</li>
              <li>Send booking confirmations and updates via email.</li>
              <li>Respond to your enquiries and provide customer support.</li>
              <li>Process payments securely through Razorpay.</li>
              <li>Improve our website, services, and user experience.</li>
              <li>Prevent fraud and ensure the security of our platform.</li>
              <li>Comply with legal obligations.</li>
            </ul>
          </div>

          {/* Sharing of Information */}
          <div>
            <h2 className="text-lg font-semibold text-sacred-burgundy mb-3">
              4. Sharing of Information
            </h2>
            <p className="mb-3">
              We do not sell, trade, or rent your personal information. We may share
              your data with:
            </p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>
                <strong>Razorpay:</strong> For secure payment processing.
              </li>
              <li>
                <strong>Supabase:</strong> For secure database and file storage.
              </li>
              <li>
                <strong>Resend:</strong> To send transactional booking confirmation
                and update emails.
              </li>
              <li>
                <strong>Sentry:</strong> For error tracking and performance monitoring.
              </li>
              <li>
                <strong>Legal Authorities:</strong> When required by law, court order,
                or to protect our rights and safety.
              </li>
            </ul>
          </div>

          {/* Data Storage & Security */}
          <div>
            <h2 className="text-lg font-semibold text-sacred-burgundy mb-3">
              5. Data Storage &amp; Security
            </h2>
            <p>
              Your data is stored securely in a PostgreSQL database hosted on
              trusted cloud infrastructure. We implement industry-standard security
              measures including:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 mt-3">
              <li>Encrypted data transmission (HTTPS/TLS).</li>
              <li>Hashed authentication tokens (SHA-256).</li>
              <li>Rate limiting to prevent abuse.</li>
              <li>Input validation and sanitisation on all data.</li>
              <li>CORS origin restrictions.</li>
            </ul>
            <p className="mt-3">
              While we strive to protect your information, no method of electronic
              transmission or storage is 100% secure. We cannot guarantee absolute
              security.
            </p>
          </div>

          {/* Cookies */}
          <div>
            <h2 className="text-lg font-semibold text-sacred-burgundy mb-3">
              6. Cookies
            </h2>
            <p>
              We use strictly necessary cookies for session management and CSRF
              protection. These cookies are essential for the website to function
              and cannot be opted out of. We do not use analytics or advertising
              cookies.
            </p>
          </div>

          {/* Your Rights */}
          <div>
            <h2 className="text-lg font-semibold text-sacred-burgundy mb-3">
              7. Your Rights
            </h2>
            <p className="mb-3">You have the right to:</p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>
                <strong>Access:</strong> Request a copy of the personal data we hold
                about you.
              </li>
              <li>
                <strong>Correction:</strong> Request correction of inaccurate or
                incomplete data.
              </li>
              <li>
                <strong>Deletion:</strong> Request deletion of your personal data,
                subject to legal and contractual obligations.
              </li>
              <li>
                <strong>Withdraw Consent:</strong> Withdraw consent for data
                processing where consent is the legal basis.
              </li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, please contact us at{" "}
              <a
                href="mailto:info@oursacredspace.in"
                className="text-sacred-green hover:underline"
              >
                info@oursacredspace.in
              </a>
              .
            </p>
          </div>

          {/* Third-Party Links */}
          <div>
            <h2 className="text-lg font-semibold text-sacred-burgundy mb-3">
              8. Third-Party Links
            </h2>
            <p>
              Our website may contain links to external websites (e.g., social media
              profiles). We are not responsible for the privacy practices of these
              third-party sites. We encourage you to review their privacy policies.
            </p>
          </div>

          {/* Children's Privacy */}
          <div>
            <h2 className="text-lg font-semibold text-sacred-burgundy mb-3">
              9. Children&apos;s Privacy
            </h2>
            <p>
              Our services are not directed at children under 18. We do not
              knowingly collect personal information from children. If you believe a
              child has provided us with personal data, please contact us and we
              will delete it promptly.
            </p>
          </div>

          {/* Changes to This Policy */}
          <div>
            <h2 className="text-lg font-semibold text-sacred-burgundy mb-3">
              10. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. Changes will be
              posted on this page with an updated &quot;Last updated&quot; date. We encourage
              you to review this policy periodically.
            </p>
          </div>

          {/* Contact Us */}
          <div>
            <h2 className="text-lg font-semibold text-sacred-burgundy mb-3">
              11. Contact Us
            </h2>
            <p>
              If you have any questions about this Privacy Policy, please contact
              us:
            </p>
            <ul className="list-none pl-0 space-y-1.5 mt-3">
              <li>
                <strong>Email:</strong>{" "}
                <a
                  href="mailto:info@oursacredspace.in"
                  className="text-sacred-green hover:underline"
                >
                  info@oursacredspace.in
                </a>
              </li>
              <li>
                <strong>Phone:</strong>{" "}
                <a
                  href="tel:+914027617444"
                  className="text-sacred-green hover:underline"
                >
                  +91 40 2761 7444
                </a>
              </li>
              <li>
                <strong>Address:</strong> Shop Marredpally, Before Himalaya Book World, 9-1-84, Sardar Patel Rd, beside Orchids Flower, Regimental Bazaar, East Marredpally, Secunderabad, Telangana 500026
              </li>
            </ul>
          </div>
        </div>

        {/* Back link */}
        <div className="mt-12 pt-8 border-t border-sacred-burgundy/20">
          <Link
            href="/"
            className="text-sm text-sacred-green hover:underline"
          >
            &larr; Back to Home
          </Link>
        </div>
      </div>
    </section>
  );
}
