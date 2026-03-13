"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { 
  Calendar, 
  Users, 
  Ticket, 
  MapPin, 
  TrendingUp,
  ArrowRight,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { adminApi } from "@/lib/api";
import { ADMIN_ROUTE_PREFIX } from "@/lib/constants";

const formatPrice = (paise: number): string => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
  }).format(paise / 100);
};

export default function AdminDashboardPage() {
  const { data: bookingsData, isLoading: bookingsLoading } = useQuery({
    queryKey: ["admin", "bookings"],
    queryFn: () => adminApi.listBookings({ limit: 5 }),
  });

  const { data: classesData, isLoading: classesLoading } = useQuery({
    queryKey: ["admin", "classes"],
    queryFn: () => adminApi.listClasses(),
  });

  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ["admin", "events"],
    queryFn: () => adminApi.listEvents(),
  });

  const { data: spaceData, isLoading: spaceLoading } = useQuery({
    queryKey: ["admin", "spaceRequests"],
    queryFn: () => adminApi.listSpaceRequests(),
  });

  const isLoading = bookingsLoading || classesLoading || eventsLoading || spaceLoading;

  // Get bookings array from response
  const bookingsResponse = bookingsData?.data as any;
  const bookings: any[] = Array.isArray(bookingsResponse) 
    ? bookingsResponse 
    : bookingsResponse?.bookings || [];
  const classes: any[] = classesData?.data || [];
  const events: any[] = eventsData?.data || [];
  const spaceRequests: any[] = spaceData?.data || [];

  // Calculate stats
  const totalBookings = bookings.length;
  const confirmedBookings = bookings.filter(b => b.status === "CONFIRMED").length;
  const pendingBookings = bookings.filter(b => b.status === "PENDING_PAYMENT").length;
  
  const totalClasses = classes.length;
  const activeClasses = classes.filter(c => c.active).length;
  
  const totalEvents = events.length;
  const activeEvents = events.filter(e => e.active).length;
  
  const pendingSpaceRequests = spaceRequests.filter(s => s.status === "REQUESTED").length;

  // Calculate revenue
  const totalRevenue = bookings
    .filter(b => b.status === "CONFIRMED")
    .reduce((sum, b) => sum + (b.amountPaise || 0), 0);

  const stats = [
    {
      title: "Total Bookings",
      value: totalBookings,
      description: `${confirmedBookings} confirmed, ${pendingBookings} pending`,
      icon: Calendar,
      href: `${ADMIN_ROUTE_PREFIX}/bookings`,
      color: "text-sacred-green",
      bgColor: "bg-sacred-green/10",
    },
    {
      title: "Classes",
      value: totalClasses,
      description: `${activeClasses} active classes`,
      icon: Users,
      href: `${ADMIN_ROUTE_PREFIX}/classes`,
      color: "text-sacred-burgundy",
      bgColor: "bg-sacred-burgundy/10",
    },
    {
      title: "Events",
      value: totalEvents,
      description: `${activeEvents} upcoming events`,
      icon: Ticket,
      href: `${ADMIN_ROUTE_PREFIX}/events`,
      color: "text-sacred-pink-dark",
      bgColor: "bg-sacred-pink/20",
    },
    {
      title: "Space Requests",
      value: pendingSpaceRequests,
      description: "Pending review",
      icon: MapPin,
      href: `${ADMIN_ROUTE_PREFIX}/space`,
      color: "text-sacred-green-dark",
      bgColor: "bg-sacred-cream",
    },
  ];

  return (
    <div className="space-y-5 sm:space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-sacred-burgundy">Dashboard</h1>
        <p className="text-sm sm:text-base text-gray-500">
          Overview of your OSS booking system
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`h-7 w-7 sm:h-8 sm:w-8 rounded-lg ${stat.bgColor} flex items-center justify-center flex-shrink-0`}>
                <stat.icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              {isLoading ? (
                <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <div className="text-xl sm:text-2xl font-bold">{stat.value}</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">{stat.description}</p>
                  <Button asChild variant="link" className="px-0 mt-1 sm:mt-2 h-auto text-xs sm:text-sm">
                    <Link href={stat.href}>
                      View all <ArrowRight className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue Card */}
      <Card className="border-sacred-green/20 bg-gradient-to-br from-sacred-green/5 to-transparent">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-sacred-green" />
            Total Revenue
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">From confirmed bookings</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          {isLoading ? (
            <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-sacred-green/40" />
          ) : (
            <div className="text-2xl sm:text-4xl font-bold text-sacred-green">
              {formatPrice(totalRevenue)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Recent Bookings */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base sm:text-lg">Recent Bookings</CardTitle>
              <Button asChild variant="outline" size="sm" className="text-xs sm:text-sm h-8 shrink-0">
                <Link href={`${ADMIN_ROUTE_PREFIX}/bookings`}>View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            {bookingsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-14 sm:h-16 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : bookings.length > 0 ? (
              <div className="space-y-2 sm:space-y-3">
                {bookings.slice(0, 5).map((booking) => (
                  <div
                    key={booking.id}
                    className="flex items-start sm:items-center justify-between gap-2 p-2.5 sm:p-3 rounded-lg bg-muted/50"
                  >
                    <div className="space-y-0.5 sm:space-y-1 min-w-0">
                      <p className="font-medium text-sm sm:text-base truncate">{booking.customerName}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
                        {booking.type} • {booking.id.slice(0, 8).toUpperCase()}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge
                        variant={
                          booking.status === "CONFIRMED"
                            ? "default"
                            : booking.status === "PENDING_PAYMENT"
                            ? "outline"
                            : "secondary"
                        }
                        className="text-[10px] sm:text-xs"
                      >
                        {booking.status === "CONFIRMED" && (
                          <CheckCircle2 className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                        )}
                        {booking.status === "PENDING_PAYMENT" && (
                          <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                        )}
                        {booking.status === "CANCELLED" && (
                          <XCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                        )}
                        {booking.status.replace("_", " ")}
                      </Badge>
                      {booking.amountPaise && (
                        <p className="text-xs sm:text-sm font-medium mt-0.5 sm:mt-1">
                          {formatPrice(booking.amountPaise)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-6 sm:py-8 text-sm">
                No bookings yet
              </p>
            )}
          </CardContent>
        </Card>

        {/* Pending Space Requests */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base sm:text-lg">Pending Space Requests</CardTitle>
              <Button asChild variant="outline" size="sm" className="text-xs sm:text-sm h-8 shrink-0">
                <Link href={`${ADMIN_ROUTE_PREFIX}/space`}>View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            {spaceLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-14 sm:h-16 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : spaceRequests.filter(s => s.status === "REQUESTED").length > 0 ? (
              <div className="space-y-2 sm:space-y-3">
                {spaceRequests
                  .filter(s => s.status === "REQUESTED")
                  .slice(0, 5)
                  .map((request) => (
                    <div
                      key={request.id}
                      className="flex items-start sm:items-center justify-between gap-2 p-2.5 sm:p-3 rounded-lg bg-muted/50"
                    >
                      <div className="space-y-0.5 sm:space-y-1 min-w-0">
                        <p className="font-medium text-sm sm:text-base truncate">{request.booking?.customerName || "Unknown"}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1">
                          {request.purpose}
                        </p>
                      </div>
                      <Badge variant="outline" className="border-sacred-burgundy/40 text-sacred-burgundy text-[10px] sm:text-xs shrink-0">
                        Pending
                      </Badge>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-6 sm:py-8 text-sm">
                No pending requests
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
