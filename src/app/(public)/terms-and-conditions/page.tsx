import Link from "next/link";

export default function TermsAndConditionsPage() {
  return (
    <section className="min-h-[60vh] bg-sacred-cream">
      <div className="container py-16 md:py-24 max-w-4xl">
        <h1 className="text-3xl md:text-4xl font-light text-sacred-burgundy mb-2">
          Terms &amp; Conditions
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
              Welcome to Our Sacred Space. These Terms &amp; Conditions (&quot;Terms&quot;)
              govern your use of our website{" "}
              <Link href="/" className="text-sacred-green hover:underline">
                www.oursacredspace.in
              </Link>{" "}
              and our services including classes, events, workshops, co-working
              spaces, and space bookings. By accessing or using our website and
              services, you agree to be bound by these Terms.
            </p>
            <p className="mt-3">
              If you do not agree to these Terms, please do not use our website or
              services.
            </p>
          </div>

          {/* Definitions */}
          <div>
            <h2 className="text-lg font-semibold text-sacred-burgundy mb-3">
              2. Definitions
            </h2>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>
                <strong>&quot;We&quot;, &quot;Us&quot;, &quot;Our&quot;</strong> refers to Our Sacred Space,
                located at 1-8-702/A, Padma Colony, Nallakunta, Secunderabad,
                Telangana 500044.
              </li>
              <li>
                <strong>&quot;You&quot;, &quot;User&quot;</strong> refers to any individual accessing
                our website or using our services.
              </li>
              <li>
                <strong>&quot;Services&quot;</strong> refers to classes, events, workshops,
                co-working spaces, space bookings, and any other offerings provided
                through our platform.
              </li>
              <li>
                <strong>&quot;Booking&quot;</strong> refers to any reservation made through our
                website for classes, events, or spaces.
              </li>
            </ul>
          </div>

          {/* Eligibility */}
          <div>
            <h2 className="text-lg font-semibold text-sacred-burgundy mb-3">
              3. Eligibility
            </h2>
            <p>
              You must be at least 18 years of age to use our services and make
              bookings. By using our website, you represent that you are at least 18
              years old and have the legal capacity to enter into a binding agreement.
            </p>
          </div>

          {/* Bookings & Payments */}
          <div>
            <h2 className="text-lg font-semibold text-sacred-burgundy mb-3">
              4. Bookings &amp; Payments
            </h2>
            <h3 className="font-medium text-sacred-burgundy mb-2">
              4.1 Booking Process
            </h3>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>
                All bookings are subject to availability and confirmation.
              </li>
              <li>
                A booking is confirmed only after successful payment (for paid
                services) or explicit confirmation from our team (for space
                requests).
              </li>
              <li>
                You must provide accurate personal information (name, email, phone)
                when making a booking.
              </li>
            </ul>

            <h3 className="font-medium text-sacred-burgundy mt-4 mb-2">
              4.2 Payments
            </h3>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>
                All payments are processed securely through Razorpay. We do not
                store your payment card details.
              </li>
              <li>
                Prices are displayed in Indian Rupees (INR) and are inclusive of
                applicable taxes unless stated otherwise.
              </li>
              <li>
                Payment must be completed within the specified time window. Unpaid
                bookings may be automatically expired.
              </li>
            </ul>

            <h3 className="font-medium text-sacred-burgundy mt-4 mb-2">
              4.3 Event Passes
            </h3>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>
                Upon successful payment for events, a unique digital pass with a QR
                code will be generated.
              </li>
              <li>
                Event passes are non-transferable and valid only for the named
                attendee.
              </li>
              <li>
                You must present your pass (digital or printed) for entry at the
                event venue.
              </li>
            </ul>
          </div>

          {/* Cancellation & Refunds */}
          <div>
            <h2 className="text-lg font-semibold text-sacred-burgundy mb-3">
              5. Cancellation &amp; Refund Policy
            </h2>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>
                Cancellation requests must be made at least 24 hours before the
                scheduled class or event.
              </li>
              <li>
                Refunds, if applicable, will be processed within 7–10 business days
                to the original payment method.
              </li>
              <li>
                We reserve the right to cancel or reschedule events/classes due to
                unforeseen circumstances. In such cases, a full refund or
                rescheduled booking will be offered.
              </li>
              <li>
                No-shows (failure to attend without prior cancellation) are not
                eligible for refunds.
              </li>
              <li>
                Space booking cancellations are subject to individual terms
                communicated during the approval process.
              </li>
            </ul>
          </div>

          {/* Space Bookings */}
          <div>
            <h2 className="text-lg font-semibold text-sacred-burgundy mb-3">
              6. Space Bookings
            </h2>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>
                Space booking requests are subject to approval by our team.
              </li>
              <li>
                Upon submission of a space enquiry, our team will review and
                schedule a call to discuss your requirements.
              </li>
              <li>
                Final confirmation of space bookings is at our sole discretion based
                on availability, purpose, and suitability.
              </li>
              <li>
                Users must adhere to the space usage guidelines provided during the
                booking process.
              </li>
            </ul>
          </div>

          {/* Code of Conduct */}
          <div>
            <h2 className="text-lg font-semibold text-sacred-burgundy mb-3">
              7. Code of Conduct
            </h2>
            <p className="mb-3">
              When attending our classes, events, or using our spaces, you agree to:
            </p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>Treat all staff, instructors, and fellow attendees with respect.</li>
              <li>Follow all safety guidelines and instructions provided.</li>
              <li>Not engage in any disruptive, harmful, or unlawful behaviour.</li>
              <li>Keep the premises clean and return equipment/furniture to its original state.</li>
              <li>Not photograph or record other attendees without their consent.</li>
            </ul>
            <p className="mt-3">
              We reserve the right to deny entry or remove individuals who violate
              this code of conduct, without refund.
            </p>
          </div>

          {/* Intellectual Property */}
          <div>
            <h2 className="text-lg font-semibold text-sacred-burgundy mb-3">
              8. Intellectual Property
            </h2>
            <p>
              All content on this website — including text, images, logos, videos,
              graphics, and design — is the property of Our Sacred Space or its
              content creators and is protected by copyright laws. You may not
              reproduce, distribute, or use any content without prior written
              permission.
            </p>
          </div>

          {/* Website Use */}
          <div>
            <h2 className="text-lg font-semibold text-sacred-burgundy mb-3">
              9. Website Use
            </h2>
            <p className="mb-3">You agree not to:</p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>Use the website for any unlawful purpose.</li>
              <li>Attempt to gain unauthorised access to any part of the website or its systems.</li>
              <li>Interfere with or disrupt the website&apos;s functionality.</li>
              <li>Submit false or misleading information.</li>
              <li>Use automated tools (bots, scrapers) to access the website without permission.</li>
            </ul>
          </div>

          {/* Limitation of Liability */}
          <div>
            <h2 className="text-lg font-semibold text-sacred-burgundy mb-3">
              10. Limitation of Liability
            </h2>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>
                Our Sacred Space shall not be liable for any indirect, incidental,
                or consequential damages arising from the use of our website or
                services.
              </li>
              <li>
                We are not responsible for any injuries, loss of property, or
                damages that occur at our premises, except where caused by our
                negligence.
              </li>
              <li>
                Our total liability for any claim shall not exceed the amount paid
                by you for the specific service in question.
              </li>
              <li>
                We do not guarantee uninterrupted or error-free operation of our
                website.
              </li>
            </ul>
          </div>

          {/* Indemnification */}
          <div>
            <h2 className="text-lg font-semibold text-sacred-burgundy mb-3">
              11. Indemnification
            </h2>
            <p>
              You agree to indemnify and hold harmless Our Sacred Space, its
              directors, employees, and partners from any claims, damages, losses,
              or expenses arising from your breach of these Terms or misuse of our
              services.
            </p>
          </div>

          {/* Modifications */}
          <div>
            <h2 className="text-lg font-semibold text-sacred-burgundy mb-3">
              12. Changes to These Terms
            </h2>
            <p>
              We reserve the right to update these Terms at any time. Changes will
              be posted on this page with an updated &quot;Last updated&quot; date.
              Continued use of the website after changes constitutes acceptance of
              the new Terms.
            </p>
          </div>

          {/* Governing Law */}
          <div>
            <h2 className="text-lg font-semibold text-sacred-burgundy mb-3">
              13. Governing Law &amp; Jurisdiction
            </h2>
            <p>
              These Terms are governed by the laws of India. Any disputes arising
              from these Terms shall be subject to the exclusive jurisdiction of the
              courts in Hyderabad, Telangana, India.
            </p>
          </div>

          {/* Severability */}
          <div>
            <h2 className="text-lg font-semibold text-sacred-burgundy mb-3">
              14. Severability
            </h2>
            <p>
              If any provision of these Terms is found to be unenforceable or
              invalid, the remaining provisions shall continue in full force and
              effect.
            </p>
          </div>

          {/* Contact Us */}
          <div>
            <h2 className="text-lg font-semibold text-sacred-burgundy mb-3">
              15. Contact Us
            </h2>
            <p>
              If you have any questions about these Terms &amp; Conditions, please
              contact us:
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
                <strong>Address:</strong> 1-8-702/A, Padma Colony, Nallakunta,
                Secunderabad, Telangana 500044
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
