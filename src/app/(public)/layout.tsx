import { Header, Footer } from "@/components/shared";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <Header />
      <main className="flex-1 overflow-x-hidden pt-[88px]">{children}</main>
      <Footer />
    </div>
  );
}
