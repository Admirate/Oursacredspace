import type { Metadata } from "next";
import Script from "next/script";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { LenisProvider } from "@/components/providers/LenisProvider";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "OSS Space | Classes, Events & Creative Spaces",
    template: "%s | OSS Space",
  },
  description:
    "Book classes, get event passes, and reserve creative spaces at OSS. Join our community for workshops, events, and collaboration.",
  keywords: [
    "OSS",
    "creative space",
    "classes",
    "events",
    "workshops",
    "booking",
    "Mumbai",
  ],
  authors: [{ name: "OSS Space" }],
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://ossspace.com",
    siteName: "OSS Space",
    title: "OSS Space | Classes, Events & Creative Spaces",
    description:
      "Book classes, get event passes, and reserve creative spaces at OSS.",
  },
  twitter: {
    card: "summary_large_image",
    title: "OSS Space | Classes, Events & Creative Spaces",
    description:
      "Book classes, get event passes, and reserve creative spaces at OSS.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Disable Netlify RUM to prevent console errors from ad blockers */}
        <Script
          id="disable-netlify-rum"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `window.__NETLIFY_DISABLE_RUM = true;`,
          }}
        />
      </head>
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}
      >
        <QueryProvider>
          <LenisProvider>
            {children}
            <Toaster />
          </LenisProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
