import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Space Enquiry",
  description:
    "Enquire about booking a space at Our Sacred Space — tell us your requirements and we'll find the perfect slot for your event, workshop, or gathering.",
  openGraph: {
    title: "Space Enquiry | Our Sacred Space",
    description:
      "Enquire about booking a space at Our Sacred Space for your event, workshop, or gathering.",
  },
};

export default function SpaceEnquiryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
