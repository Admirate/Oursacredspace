import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Classes",
  description:
    "Explore and book classes at Our Sacred Space — from classical dance and yoga to music and art. Join sessions led by experienced instructors in a calm, creative environment.",
  openGraph: {
    title: "Classes | Our Sacred Space",
    description:
      "Explore and book classes at Our Sacred Space — from classical dance and yoga to music and art.",
  },
};

export default function ClassesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
