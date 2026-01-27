"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Search, 
  Filter, 
  Loader2, 
  Calendar, 
  Mail, 
  Phone,
  ChevronLeft,
  ChevronRight,
  Eye
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { adminApi } from "@/lib/api";
import type { Booking } from "@/types";

const formatPrice = (paise: number): string => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
  }).format(paise / 100);
};

const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (date: string): string => {
  return new Date(date).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const getStatusBadge = (status: string) => {
  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
    CONFIRMED: { variant: "default", className: "bg-green-500" },
    PENDING_PAYMENT: { variant: "outline", className: "border-yellow-500 text-yellow-600" },
    CANCELLED: { variant: "destructive" },
    REQUESTED: { variant: "secondary" },
    APPROVED: { variant: "default", className: "bg-blue-500" },
  };
  const config = variants[status] || { variant: "outline" as const };
  return (
    <Badge variant={config.variant} className={config.className}>
      {status.replace("_", " ")}
    </Badge>
  );
};

const getTypeBadge = (type: string) => {
  const colors: Record<string, string> = {
    CLASS: "bg-purple-100 text-purple-700",
    EVENT: "bg-blue-100 text-blue-700",
    SPACE: "bg-orange-100 text-orange-700",
  };
  return (
    <Badge variant="outline" className={colors[type] || ""}>
      {type}
    </Badge>
  );
};

export default function AdminBookingsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const limit = 20;

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "bookings", typeFilter, statusFilter, page],
    queryFn: () =>
      adminApi.listBookings({
        type: typeFilter !== "all" ? (typeFilter as "CLASS" | "EVENT" | "SPACE") : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        page,
        limit,
      }),
  });

  // Handle both array and object response formats
  const responseData = data?.data as any;
  const bookings = Array.isArray(responseData) 
    ? responseData 
    : responseData?.bookings || [];
  const totalPages = responseData?.totalPages || (data as any)?.pagination?.totalPages || 1;

  // Client-side search filter
  const filteredBookings = bookings.filter((booking: any) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      booking.customerName.toLowerCase().includes(searchLower) ||
      booking.customerEmail.toLowerCase().includes(searchLower) ||
      booking.customerPhone.includes(search) ||
      booking.id.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Bookings</h1>
        <p className="text-muted-foreground">
          Manage all bookings across classes, events, and space requests
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, phone, or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="CLASS">Classes</SelectItem>
                <SelectItem value="EVENT">Events</SelectItem>
                <SelectItem value="SPACE">Space</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                <SelectItem value="PENDING_PAYMENT">Pending Payment</SelectItem>
                <SelectItem value="REQUESTED">Requested</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-16 text-destructive">
              Failed to load bookings. Please try again.
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              No bookings found
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Booking ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBookings.map((booking) => (
                    <TableRow key={booking.id}>
                      <TableCell className="font-mono text-sm">
                        {booking.id.slice(0, 8).toUpperCase()}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{booking.customerName}</p>
                          <p className="text-xs text-muted-foreground">
                            {booking.customerEmail}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{getTypeBadge(booking.type)}</TableCell>
                      <TableCell>{getStatusBadge(booking.status)}</TableCell>
                      <TableCell>
                        {booking.amountPaise ? formatPrice(booking.amountPaise) : "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(booking.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedBooking(booking)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Booking Details Dialog */}
      <Dialog open={!!selectedBooking} onOpenChange={() => setSelectedBooking(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Booking Details</DialogTitle>
            <DialogDescription>
              ID: {selectedBooking?.id.slice(0, 8).toUpperCase()}
            </DialogDescription>
          </DialogHeader>

          {selectedBooking && (
            <div className="space-y-4">
              <div className="flex gap-2">
                {getTypeBadge(selectedBooking.type)}
                {getStatusBadge(selectedBooking.status)}
              </div>

              <Separator />

              <div className="space-y-3">
                <h4 className="font-semibold">Customer Information</h4>
                <div className="space-y-2 text-sm">
                  <p className="font-medium">{selectedBooking.customerName}</p>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    {selectedBooking.customerEmail}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    {selectedBooking.customerPhone}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h4 className="font-semibold">Booking Information</h4>
                <div className="space-y-2 text-sm">
                  {selectedBooking.classSession && (
                    <p>
                      <span className="text-muted-foreground">Class:</span>{" "}
                      {selectedBooking.classSession.title}
                    </p>
                  )}
                  {selectedBooking.event && (
                    <p>
                      <span className="text-muted-foreground">Event:</span>{" "}
                      {selectedBooking.event.title}
                    </p>
                  )}
                  {selectedBooking.amountPaise && (
                    <p>
                      <span className="text-muted-foreground">Amount:</span>{" "}
                      <span className="font-semibold">
                        {formatPrice(selectedBooking.amountPaise)}
                      </span>
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    Created: {formatDateTime(selectedBooking.createdAt)}
                  </div>
                </div>
              </div>

              {selectedBooking.eventPass && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h4 className="font-semibold">Event Pass</h4>
                    <div className="space-y-2 text-sm">
                      <p>
                        <span className="text-muted-foreground">Pass ID:</span>{" "}
                        <span className="font-mono">{selectedBooking.eventPass.passId}</span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">Check-in:</span>{" "}
                        <Badge
                          variant={
                            selectedBooking.eventPass.checkInStatus === "CHECKED_IN"
                              ? "default"
                              : "outline"
                          }
                        >
                          {selectedBooking.eventPass.checkInStatus.replace("_", " ")}
                        </Badge>
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
