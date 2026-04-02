import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Visit Us",
  description:
    "Plan your visit to Our Sacred Space — find directions, timings, and everything you need to know before you arrive. Located in a serene, green campus.",
  openGraph: {
    title: "Visit Us | Our Sacred Space",
    description:
      "Plan your visit to Our Sacred Space — directions, timings, and what to expect.",
  },
};

export default function VisitLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
