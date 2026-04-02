import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sitemap",
  description:
    "Browse all pages on Our Sacred Space — classes, events, workshops, co-working, community initiatives, and more.",
};

const sections = [
  {
    title: "Main",
    links: [
      { label: "Home", href: "/" },
      { label: "Classes", href: "/classes" },
      { label: "Events", href: "/events" },
      { label: "Workshops", href: "/workshops" },
    ],
  },
  {
    title: "Spaces",
    links: [
      { label: "Co-Working Space", href: "/co-working-space" },
      { label: "Book a Space", href: "/book-space" },
      { label: "Space Enquiry", href: "/space-enquiry" },
    ],
  },
  {
    title: "Community",
    links: [
      { label: "Community", href: "/community" },
      { label: "Initiatives", href: "/initiatives" },
    ],
  },
  {
    title: "Info",
    links: [
      { label: "Visit Us", href: "/visit" },
      { label: "Contact", href: "/contact" },
    ],
  },
];

export default function SitemapPage() {
  return (
    <section className="min-h-[60vh] bg-sacred-cream">
      <div className="container py-16 md:py-24">
        <h1 className="text-3xl md:text-4xl font-light text-sacred-burgundy mb-4">
          Sitemap
        </h1>
        <p className="text-sacred-burgundy/70 mb-12 max-w-xl">
          A complete overview of all pages on Our Sacred Space.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {sections.map((section) => (
            <div key={section.title}>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-sacred-burgundy mb-4">
                {section.title}
              </h2>
              <ul className="space-y-3">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-sacred-burgundy/80 hover:text-sacred-green transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
