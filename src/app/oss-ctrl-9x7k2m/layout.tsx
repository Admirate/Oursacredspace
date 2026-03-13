"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Ticket,
  MapPin,
  Menu,
  X,
  LogOut,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { adminApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { getAssetUrl } from "@/lib/assets";
import { ADMIN_ROUTE_PREFIX } from "@/lib/constants";

const navItems = [
  {
    title: "Dashboard",
    href: ADMIN_ROUTE_PREFIX,
    icon: LayoutDashboard,
  },
  {
    title: "Bookings",
    href: `${ADMIN_ROUTE_PREFIX}/bookings`,
    icon: Calendar,
  },
  {
    title: "Classes",
    href: `${ADMIN_ROUTE_PREFIX}/classes`,
    icon: Users,
  },
  {
    title: "Events",
    href: `${ADMIN_ROUTE_PREFIX}/events`,
    icon: Ticket,
  },
  {
    title: "Space Requests",
    href: `${ADMIN_ROUTE_PREFIX}/space`,
    icon: MapPin,
  },
];

const NavLink = ({
  href,
  icon: Icon,
  title,
  isActive,
  onClick,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  isActive: boolean;
  onClick?: () => void;
}) => (
  <Link
    href={href}
    onClick={onClick}
    className={cn(
      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium",
      isActive
        ? "bg-sacred-green text-white shadow-sm shadow-sacred-green/20"
        : "text-gray-600 hover:bg-sacred-cream hover:text-sacred-green"
    )}
  >
    <Icon className="h-5 w-5" />
    <span>{title}</span>
    {isActive && <ChevronRight className="ml-auto h-4 w-4" />}
  </Link>
);

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      if (pathname === `${ADMIN_ROUTE_PREFIX}/login`) {
        setIsCheckingAuth(false);
        return;
      }

      try {
        const response = await adminApi.listBookings({ limit: 1 });
        if (response.success) {
          setIsAuthenticated(true);
        } else {
          router.replace(`${ADMIN_ROUTE_PREFIX}/login`);
        }
      } catch (error) {
        router.replace(`${ADMIN_ROUTE_PREFIX}/login`);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, [pathname, router]);

  if (pathname === `${ADMIN_ROUTE_PREFIX}/login`) {
    return <>{children}</>;
  }

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sacred-cream">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-sacred-green" />
          <p className="text-gray-500">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const handleLogout = async () => {
    try {
      await adminApi.logout();
      toast({
        title: "Logged out",
        description: "You have been logged out successfully.",
      });
      router.push(`${ADMIN_ROUTE_PREFIX}/login`);
    } catch (error) {
      router.push(`${ADMIN_ROUTE_PREFIX}/login`);
    }
  };

  const isActive = (href: string) => {
    if (href === ADMIN_ROUTE_PREFIX) {
      return pathname === ADMIN_ROUTE_PREFIX;
    }
    return pathname.startsWith(href);
  };

  const SidebarContent = ({ onNavClick }: { onNavClick?: () => void }) => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-sacred-cream-dark px-5">
        <Link
          href={ADMIN_ROUTE_PREFIX}
          className="flex items-center gap-3"
          onClick={onNavClick}
        >
          <img
            src={getAssetUrl("brand/logo.png")}
            alt="Our Sacred Space"
            className="h-9 w-auto object-contain"
          />
          <div className="flex flex-col">
            <span className="font-bold text-sm text-sacred-burgundy leading-tight">
              OSS Admin
            </span>
            <span className="text-[10px] text-gray-400 leading-tight">
              Management Portal
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-3">
          Menu
        </p>
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            icon={item.icon}
            title={item.title}
            isActive={isActive(item.href)}
            onClick={onNavClick}
          />
        ))}
      </nav>

      {/* Logout */}
      <div className="border-t border-sacred-cream-dark p-4">
        <Button
          variant="ghost"
          className="w-full justify-start text-gray-500 hover:text-sacred-burgundy hover:bg-sacred-pink/10"
          onClick={() => {
            onNavClick?.();
            handleLogout();
          }}
        >
          <LogOut className="mr-3 h-5 w-5" />
          Logout
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50/80">
      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 border-r border-sacred-cream-dark bg-white lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile Header */}
      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-sacred-cream-dark bg-white px-4 lg:hidden">
        <Sheet open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-sacred-green">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SidebarContent onNavClick={() => setIsMobileNavOpen(false)} />
          </SheetContent>
        </Sheet>

        <Link href={ADMIN_ROUTE_PREFIX} className="flex items-center gap-2">
          <img
            src={getAssetUrl("brand/logo.png")}
            alt="Our Sacred Space"
            className="h-8 w-auto object-contain"
          />
          <span className="font-bold text-sacred-burgundy">OSS Admin</span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="lg:pl-64">
        <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
