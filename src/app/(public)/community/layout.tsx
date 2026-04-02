import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Community",
  description:
    "Be part of the Our Sacred Space community — a gathering of artists, creators, and seekers. Connect, collaborate, and grow together in a nurturing space.",
  openGraph: {
    title: "Community | Our Sacred Space",
    description:
      "Be part of the Our Sacred Space community — a gathering of artists, creators, and seekers.",
  },
};

export default function CommunityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
