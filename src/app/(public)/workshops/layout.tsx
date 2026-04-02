import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Workshops",
  description:
    "Join hands-on workshops at Our Sacred Space — immersive learning experiences in arts, crafts, wellness, and creative expression. Limited seats, register now.",
  openGraph: {
    title: "Workshops | Our Sacred Space",
    description:
      "Join hands-on workshops at Our Sacred Space — immersive learning experiences in arts, crafts, and wellness.",
  },
};

export default function WorkshopsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
