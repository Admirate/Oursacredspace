import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Book a Space",
  description:
    "Rent creative spaces at Our Sacred Space — indoor halls, open courtyards, studios, and flexible rooms for performances, workshops, meetings, and gatherings.",
  openGraph: {
    title: "Book a Space | Our Sacred Space",
    description:
      "Rent creative spaces at Our Sacred Space — halls, courtyards, studios for your events and gatherings.",
  },
};

export default function BookSpaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
