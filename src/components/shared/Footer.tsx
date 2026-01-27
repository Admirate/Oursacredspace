import Link from "next/link";
import { Mail, Phone, MapPin, Instagram, Facebook, Youtube } from "lucide-react";

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative bg-sacred-pink">
      <div className="container py-12 md:py-16 lg:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12">
          {/* Brand Section */}
          <div className="lg:col-span-1">
            <Link 
              href="/" 
              className="inline-block mb-5"
              aria-label="Our Sacred Space Home"
            >
              <h2 className="text-2xl md:text-3xl font-light text-sacred-burgundy italic">
                Our Sacred Space
              </h2>
            </Link>
            <p className="text-sm text-sacred-burgundy/80 leading-relaxed mb-6 max-w-xs">
              A cultural and community centre in Secunderabad, bringing together art, 
              wellness, learning, and environmental awareness since 2012.
            </p>
            
            {/* Social Links */}
            <div className="flex items-center gap-4">
              <a
                href="https://instagram.com/oursacredspace"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-10 h-10 rounded-full bg-sacred-burgundy/10 text-sacred-burgundy hover:bg-sacred-burgundy hover:text-white transition-all duration-300"
                aria-label="Follow us on Instagram"
                tabIndex={0}
              >
                <Instagram className="h-5 w-5" />
              </a>
              <a
                href="https://facebook.com/oursacredspace"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-10 h-10 rounded-full bg-sacred-burgundy/10 text-sacred-burgundy hover:bg-sacred-burgundy hover:text-white transition-all duration-300"
                aria-label="Follow us on Facebook"
                tabIndex={0}
              >
                <Facebook className="h-5 w-5" />
              </a>
              <a
                href="https://youtube.com/@oursacredspace"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-10 h-10 rounded-full bg-sacred-burgundy/10 text-sacred-burgundy hover:bg-sacred-burgundy hover:text-white transition-all duration-300"
                aria-label="Subscribe on YouTube"
                tabIndex={0}
              >
                <Youtube className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Explore Links */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-sacred-burgundy mb-5">
              Explore
            </h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/classes"
                  className="text-sm text-sacred-burgundy/80 hover:text-sacred-green transition-colors inline-block"
                  tabIndex={0}
                >
                  Classes
                </Link>
              </li>
              <li>
                <Link
                  href="/events"
                  className="text-sm text-sacred-burgundy/80 hover:text-sacred-green transition-colors inline-block"
                  tabIndex={0}
                >
                  Events & Workshops
                </Link>
              </li>
              <li>
                <Link
                  href="/book-space"
                  className="text-sm text-sacred-burgundy/80 hover:text-sacred-green transition-colors inline-block"
                  tabIndex={0}
                >
                  Book a Space
                </Link>
              </li>
              <li>
                <Link
                  href="/community"
                  className="text-sm text-sacred-burgundy/80 hover:text-sacred-green transition-colors inline-block"
                  tabIndex={0}
                >
                  Community
                </Link>
              </li>
            </ul>
          </div>

          {/* Support Links */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-sacred-burgundy mb-5">
              Support
            </h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/contact"
                  className="text-sm text-sacred-burgundy/80 hover:text-sacred-green transition-colors inline-block"
                  tabIndex={0}
                >
                  Contact Us
                </Link>
              </li>
              <li>
                <Link
                  href="/visit"
                  className="text-sm text-sacred-burgundy/80 hover:text-sacred-green transition-colors inline-block"
                  tabIndex={0}
                >
                  Visit Us
                </Link>
              </li>
              <li>
                <Link
                  href="/initiatives"
                  className="text-sm text-sacred-burgundy/80 hover:text-sacred-green transition-colors inline-block"
                  tabIndex={0}
                >
                  Initiatives
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-sacred-burgundy mb-5">
              Visit Us
            </h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-sacred-green shrink-0 mt-0.5" aria-hidden="true" />
                <span className="text-sm text-sacred-burgundy/80 leading-relaxed">
                  1-8-702/A, Padma Colony,<br />
                  Nallakunta, Secunderabad,<br />
                  Telangana 500044
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-sacred-green shrink-0" aria-hidden="true" />
                <a
                  href="tel:+914027617444"
                  className="text-sm text-sacred-burgundy/80 hover:text-sacred-green transition-colors"
                  tabIndex={0}
                >
                  +91 40 2761 7444
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-sacred-green shrink-0" aria-hidden="true" />
                <a
                  href="mailto:info@oursacredspace.in"
                  className="text-sm text-sacred-burgundy/80 hover:text-sacred-green transition-colors"
                  tabIndex={0}
                >
                  info@oursacredspace.in
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-sacred-burgundy/20">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-sacred-burgundy/70">
              © {currentYear} Our Sacred Space. All rights reserved.
            </p>
            <p className="text-sm text-sacred-burgundy/70 flex items-center gap-1">
              Made with <span className="text-sacred-pink-dark">♡</span> in Secunderabad
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};
