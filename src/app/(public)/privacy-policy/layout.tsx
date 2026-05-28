import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Learn how Our Sacred Space collects, uses, and protects your personal information. Read our full privacy policy.",
  openGraph: {
    title: "Privacy Policy | Our Sacred Space",
    description:
      "Learn how Our Sacred Space collects, uses, and protects your personal information.",
  },
};

export default function PrivacyPolicyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
