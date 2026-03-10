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
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-sacred-burgundy">Dashboard</h1>
        <p className="text-gray-500">
          Overview of your OSS booking system
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`h-8 w-8 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground">{stat.description}</p>
                  <Button asChild variant="link" className="px-0 mt-2">
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-sacred-green" />
            Total Revenue
          </CardTitle>
          <CardDescription>From confirmed bookings</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Loader2 className="h-8 w-8 animate-spin text-sacred-green/40" />
          ) : (
            <div className="text-4xl font-bold text-sacred-green">
              {formatPrice(totalRevenue)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Bookings */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Bookings</CardTitle>
              <Button asChild variant="outline" size="sm">
                <Link href={`${ADMIN_ROUTE_PREFIX}/bookings`}>View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {bookingsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : bookings.length > 0 ? (
              <div className="space-y-3">
                {bookings.slice(0, 5).map((booking) => (
                  <div
                    key={booking.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="space-y-1">
                      <p className="font-medium">{booking.customerName}</p>
                      <p className="text-xs text-muted-foreground">
                        {booking.type} • {booking.id.slice(0, 8).toUpperCase()}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge
                        variant={
                          booking.status === "CONFIRMED"
                            ? "default"
                            : booking.status === "PENDING_PAYMENT"
                            ? "outline"
                            : "secondary"
                        }
                      >
                        {booking.status === "CONFIRMED" && (
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                        )}
                        {booking.status === "PENDING_PAYMENT" && (
                          <Clock className="h-3 w-3 mr-1" />
                        )}
                        {booking.status === "CANCELLED" && (
                          <XCircle className="h-3 w-3 mr-1" />
                        )}
                        {booking.status.replace("_", " ")}
                      </Badge>
                      {booking.amountPaise && (
                        <p className="text-sm font-medium mt-1">
                          {formatPrice(booking.amountPaise)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No bookings yet
              </p>
            )}
          </CardContent>
        </Card>

        {/* Pending Space Requests */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Pending Space Requests</CardTitle>
              <Button asChild variant="outline" size="sm">
                <Link href={`${ADMIN_ROUTE_PREFIX}/space`}>View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {spaceLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : spaceRequests.filter(s => s.status === "REQUESTED").length > 0 ? (
              <div className="space-y-3">
                {spaceRequests
                  .filter(s => s.status === "REQUESTED")
                  .slice(0, 5)
                  .map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="space-y-1">
                        <p className="font-medium">{request.booking?.customerName || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {request.purpose}
                        </p>
                      </div>
                      <Badge variant="outline" className="border-sacred-burgundy/40 text-sacred-burgundy">
                        Pending
                      </Badge>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No pending requests
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
