import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Co-Working Space",
  description:
    "Work from Our Sacred Space — a calm, creative co-working environment with high-speed WiFi, natural light, and a community of like-minded individuals.",
  openGraph: {
    title: "Co-Working Space | Our Sacred Space",
    description:
      "Work from Our Sacred Space — a calm, creative co-working environment surrounded by greenery.",
  },
};

export default function CoWorkingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
