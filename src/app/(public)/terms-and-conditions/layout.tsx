import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description:
    "Read the terms and conditions governing your use of Our Sacred Space's website, bookings, events, and services.",
  openGraph: {
    title: "Terms & Conditions | Our Sacred Space",
    description:
      "Terms and conditions governing your use of Our Sacred Space's website and services.",
  },
};

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
