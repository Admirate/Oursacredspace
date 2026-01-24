"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { 
  CheckCircle2, 
  Loader2, 
  AlertCircle, 
  Calendar, 
  Clock, 
  MapPin, 
  Mail, 
  Phone,
  Download,
  Home,
  Ticket
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";

const formatPrice = (paise: number): string => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
  }).format(paise / 100);
};

const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const formatTime = (date: string): string => {
  return new Date(date).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "CONFIRMED":
      return <Badge className="bg-green-500">Confirmed</Badge>;
    case "PENDING_PAYMENT":
      return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Pending Payment</Badge>;
    case "CANCELLED":
      return <Badge variant="destructive">Cancelled</Badge>;
    case "REQUESTED":
      return <Badge variant="secondary">Request Submitted</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

export default function SuccessPage() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("bookingId");
  const [showPaymentSection, setShowPaymentSection] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["booking", bookingId],
    queryFn: () => api.getBooking(bookingId!),
    enabled: !!bookingId,
    refetchInterval: (query) => {
      // Poll every 5 seconds while pending payment
      const status = query.state.data?.data?.status;
      return status === "PENDING_PAYMENT" ? 5000 : false;
    },
  });

  const booking = data?.data;

  useEffect(() => {
    if (booking?.status === "PENDING_PAYMENT") {
      setShowPaymentSection(true);
    }
  }, [booking?.status]);

  // No booking ID provided
  if (!bookingId) {
    return (
      <div className="container py-12">
        <div className="max-w-lg mx-auto text-center">
          <AlertCircle className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-4">No Booking Found</h1>
          <p className="text-muted-foreground mb-8">
            It looks like you accessed this page without a booking reference.
          </p>
          <Button asChild>
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="container py-12">
        <div className="max-w-lg mx-auto text-center">
          <Loader2 className="h-16 w-16 mx-auto text-primary animate-spin mb-4" />
          <h1 className="text-2xl font-bold mb-2">Loading Booking...</h1>
          <p className="text-muted-foreground">Please wait while we fetch your booking details.</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !booking) {
    return (
      <div className="container py-12">
        <div className="max-w-lg mx-auto text-center">
          <AlertCircle className="h-16 w-16 mx-auto text-destructive mb-4" />
          <h1 className="text-2xl font-bold mb-4">Booking Not Found</h1>
          <p className="text-muted-foreground mb-8">
            We couldn't find this booking. It may have expired or the link is invalid.
          </p>
          <div className="flex gap-4 justify-center">
            <Button variant="outline" onClick={() => refetch()}>
              Try Again
            </Button>
            <Button asChild>
              <Link href="/">Go Home</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Determine booking type info
  const isClass = booking.type === "CLASS";
  const isEvent = booking.type === "EVENT";
  const isSpace = booking.type === "SPACE";
  const isConfirmed = booking.status === "CONFIRMED";
  const isPending = booking.status === "PENDING_PAYMENT";
  const isRequested = booking.status === "REQUESTED";

  return (
    <div className="container py-12">
      <div className="max-w-2xl mx-auto">
        {/* Success Header */}
        <div className="text-center mb-8">
          {isConfirmed ? (
            <>
              <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <h1 className="text-3xl font-bold mb-2">Booking Confirmed!</h1>
              <p className="text-muted-foreground">
                {isEvent 
                  ? "Your pass has been sent to your WhatsApp!"
                  : "Your booking has been confirmed. See you soon!"
                }
              </p>
            </>
          ) : isPending ? (
            <>
              <div className="h-20 w-20 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-6">
                <Clock className="h-10 w-10 text-yellow-600" />
              </div>
              <h1 className="text-3xl font-bold mb-2">Complete Your Payment</h1>
              <p className="text-muted-foreground">
                Your booking is reserved. Please complete payment to confirm.
              </p>
            </>
          ) : isRequested ? (
            <>
              <div className="h-20 w-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="h-10 w-10 text-blue-600" />
              </div>
              <h1 className="text-3xl font-bold mb-2">Request Submitted!</h1>
              <p className="text-muted-foreground">
                We'll review your request and contact you within 24 hours.
              </p>
            </>
          ) : (
            <>
              <div className="h-20 w-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6">
                <Ticket className="h-10 w-10 text-gray-600" />
              </div>
              <h1 className="text-3xl font-bold mb-2">Booking Details</h1>
            </>
          )}
        </div>

        {/* Booking Details Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>
                  {isClass && booking.classSession?.title}
                  {isEvent && booking.event?.title}
                  {isSpace && "Space Booking Request"}
                </CardTitle>
                <CardDescription>
                  Booking ID: {booking.id.slice(0, 8).toUpperCase()}
                </CardDescription>
              </div>
              {getStatusBadge(booking.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Date & Time */}
            {(isClass || isEvent) && (
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">
                    {formatDate(isClass ? booking.classSession!.startsAt : booking.event!.startsAt)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatTime(isClass ? booking.classSession!.startsAt : booking.event!.startsAt)}
                    {isClass && ` (${booking.classSession!.duration} mins)`}
                  </p>
                </div>
              </div>
            )}

            {/* Venue (for events) */}
            {isEvent && booking.event?.venue && (
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">{booking.event.venue}</p>
                </div>
              </div>
            )}

            {/* Space Request Details */}
            {isSpace && booking.spaceRequest && (
              <>
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Requested Date</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(booking.spaceRequest.preferredDate)}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Duration</p>
                    <p className="text-sm text-muted-foreground">
                      {booking.spaceRequest.duration} hour(s)
                    </p>
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Customer Details */}
            <div className="space-y-2">
              <p className="font-medium">{booking.customerName}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                {booking.customerEmail}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                {booking.customerPhone}
              </div>
            </div>

            {/* Price */}
            {booking.amountPaise && (
              <>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="font-medium">Amount</span>
                  <span className="text-xl font-bold text-primary">
                    {formatPrice(booking.amountPaise)}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Event Pass QR */}
        {isEvent && isConfirmed && booking.eventPass && (
          <Card className="mb-6 border-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ticket className="h-5 w-5" />
                Your Event Pass
              </CardTitle>
              <CardDescription>
                Pass ID: {booking.eventPass.passId}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              {booking.eventPass.qrImageUrl && (
                <div className="bg-white p-4 rounded-lg inline-block mb-4">
                  <img
                    src={booking.eventPass.qrImageUrl}
                    alt="Event Pass QR Code"
                    className="w-48 h-48 mx-auto"
                  />
                </div>
              )}
              <p className="text-sm text-muted-foreground mb-4">
                Show this QR code at the venue for entry
              </p>
              {booking.eventPass.qrImageUrl && (
                <Button variant="outline" asChild>
                  <a href={booking.eventPass.qrImageUrl} download={`pass-${booking.eventPass.passId}.png`}>
                    <Download className="mr-2 h-4 w-4" />
                    Download Pass
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Payment Section (for pending payments) */}
        {isPending && showPaymentSection && (
          <Card className="mb-6 border-yellow-500">
            <CardHeader>
              <CardTitle>Complete Payment</CardTitle>
              <CardDescription>
                Your booking will be confirmed once payment is received.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> Payment integration is being set up. 
                  For now, please contact us to complete your booking.
                </p>
              </div>
              <Button className="w-full" disabled>
                Pay {booking.amountPaise ? formatPrice(booking.amountPaise) : ""}
              </Button>
              <p className="text-xs text-center text-muted-foreground mt-2">
                Secure payment via Razorpay (UPI, Cards, Net Banking)
              </p>
            </CardContent>
          </Card>
        )}

        {/* What's Next */}
        <Card>
          <CardHeader>
            <CardTitle>What's Next?</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              {isConfirmed && isClass && (
                <>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>You'll receive a confirmation email with all details</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>Arrive 10 minutes before the class starts</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>Bring your booking ID for verification</span>
                  </li>
                </>
              )}
              {isConfirmed && isEvent && (
                <>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>Your QR pass has been sent to your WhatsApp</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>Show the QR code at the venue entrance</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>Arrive on time - the pass is valid only for this event</span>
                  </li>
                </>
              )}
              {isRequested && (
                <>
                  <li className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-blue-500 mt-0.5" />
                    <span>Our team will review your request within 24 hours</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Phone className="h-4 w-4 text-blue-500 mt-0.5" />
                    <span>We'll contact you via WhatsApp/call to confirm</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-500 mt-0.5" />
                    <span>Once confirmed, you'll receive payment details</span>
                  </li>
                </>
              )}
              {isPending && (
                <>
                  <li className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-yellow-500 mt-0.5" />
                    <span>Complete your payment to confirm the booking</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-yellow-500 mt-0.5" />
                    <span>Booking expires if not paid within 30 minutes</span>
                  </li>
                </>
              )}
            </ul>
          </CardContent>
        </Card>

        {/* Back to Home */}
        <div className="text-center mt-8">
          <Button asChild variant="outline">
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Back to Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
