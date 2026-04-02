import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Initiatives",
  description:
    "Learn about Our Sacred Space's initiatives — projects that blend culture, sustainability, and community care. We believe in nurturing both people and the environment.",
  openGraph: {
    title: "Initiatives | Our Sacred Space",
    description:
      "Learn about Our Sacred Space's initiatives — blending culture, sustainability, and community care.",
  },
};

export default function InitiativesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
