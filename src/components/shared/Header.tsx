"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { PUBLIC_NAV_ITEMS } from "@/lib/constants";
import { getAssetUrl } from "@/lib/assets";

export const Header = () => {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isScrolled, setIsScrolled] = React.useState(false);

  // Handle scroll effect
  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-50 w-full">
      {/* Green Accent Bar */}
      <div className="h-2 bg-sacred-green w-full" />
      
      {/* Main Navbar */}
      <nav
        className={cn(
          "w-full bg-white transition-shadow duration-300",
          isScrolled && "shadow-md"
        )}
      >
        <div className="container mx-auto px-4 lg:px-8">
          <div className="flex h-20 items-center justify-between">
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center gap-2 shrink-0"
              aria-label="Sacred Space Home"
            >
              <Image
                src={getAssetUrl("brand/logo.png")}
                alt="Sacred Space Logo"
                width={160}
                height={60}
                className="h-14 w-auto object-contain"
                priority
                unoptimized // Skip Next.js optimization for external images
              />
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1">
              {PUBLIC_NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-4 py-2 text-sm font-medium tracking-wide transition-colors",
                    "hover:text-sacred-green",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-sacred-green focus-visible:ring-offset-2 rounded",
                    isActive(item.href)
                      ? "text-sacred-green"
                      : "text-sacred-burgundy"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Mobile Menu Button */}
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild className="lg:hidden">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-sacred-burgundy hover:text-sacred-green hover:bg-sacred-green/10"
                  aria-label="Open menu"
                >
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent 
                side="right" 
                className="w-[300px] sm:w-[350px] bg-white border-l-2 border-sacred-green"
              >
                {/* Accessibility Title (visually hidden) */}
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                
                {/* Mobile Menu Header */}
                <div className="flex items-center justify-between pb-6 border-b border-gray-100">
                  <Image
                    src={getAssetUrl("brand/logo.png")}
                    alt="Sacred Space Logo"
                    width={120}
                    height={45}
                    className="h-10 w-auto object-contain"
                    unoptimized
                  />
                </div>

                {/* Mobile Navigation Links */}
                <nav className="flex flex-col gap-1 mt-6">
                  {PUBLIC_NAV_ITEMS.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className={cn(
                        "px-4 py-3 text-base font-medium rounded-lg transition-colors",
                        "hover:bg-sacred-green/10 hover:text-sacred-green",
                        isActive(item.href)
                          ? "bg-sacred-green/10 text-sacred-green"
                          : "text-sacred-burgundy"
                      )}
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>

                {/* Mobile CTA */}
                <div className="absolute bottom-8 left-6 right-6">
                  <Button
                    asChild
                    className="w-full bg-sacred-green hover:bg-sacred-green-dark text-white"
                    size="lg"
                  >
                    <Link href="/book-space" onClick={() => setIsOpen(false)}>
                      Book a Space
                    </Link>
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>
    </header>
  );
};
