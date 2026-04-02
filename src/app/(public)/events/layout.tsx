import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Events",
  description:
    "Discover upcoming events at Our Sacred Space — performances, exhibitions, cultural gatherings, and community celebrations. Get your event pass today.",
  openGraph: {
    title: "Events | Our Sacred Space",
    description:
      "Discover upcoming events at Our Sacred Space — performances, exhibitions, and cultural gatherings.",
  },
};

export default function EventsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
