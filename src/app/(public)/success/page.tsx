"use client";

import { Suspense, useEffect, useState } from "react";
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
  Home,
  Ticket,
  XCircle,
  RefreshCw
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { usePayment } from "@/hooks/usePayment";
import { api } from "@/lib/api";
import { POLLING_INTERVAL } from "@/lib/constants";

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
    case "PAYMENT_FAILED":
      return <Badge variant="destructive">Payment Failed</Badge>;
    case "CANCELLED":
      return <Badge variant="destructive">Cancelled</Badge>;
    case "EXPIRED":
      return <Badge variant="outline" className="border-gray-400 text-gray-500">Expired</Badge>;
    case "REQUESTED":
      return <Badge variant="secondary">Request Submitted</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const SUCCESS_POLL_MAX = 60;

function SuccessPageContent() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("bookingId");
  // SECURITY (SEC-005): The success page now requires the per-booking
  // access token returned by createBooking. Without it the backend returns
  // 404 and we render the "Booking Not Found" state.
  const accessToken = searchParams.get("token");
  const [pollCount, setPollCount] = useState(0);
  const pollTimedOut = pollCount >= SUCCESS_POLL_MAX;
  const { toast } = useToast();

  const { initiatePayment, isLoading: isPaymentLoading } = usePayment({
    onError: (err) => {
      toast({
        title: "Payment Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["booking", bookingId, accessToken],
    queryFn: () => api.getBooking(bookingId!, accessToken!),
    // SECURITY (SEC-005): both bookingId AND accessToken must be present
    // before we attempt to fetch.
    enabled: !!bookingId && !!accessToken,
    retry: 3,
    refetchInterval: (query) => {
      const status = query.state.data?.data?.status;
      if (status === "PENDING_PAYMENT" && pollCount < SUCCESS_POLL_MAX) {
        setPollCount((prev) => prev + 1);
        return POLLING_INTERVAL;
      }
      return false;
    },
  });

  const booking = data?.data;

  // No booking ID or no access token -> render the same "missing reference"
  // state. We deliberately do not distinguish between the two: a leaked
  // booking ID without a token must not produce a different UI than no ID
  // at all.
  if (!bookingId || !accessToken) {
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

  // Error state — distinguish transient vs permanent
  if (error || !booking) {
    const isNetworkError = error?.message?.includes("connect") || error?.message?.includes("timed out");
    return (
      <div className="container py-12">
        <div className="max-w-lg mx-auto text-center">
          <AlertCircle className="h-16 w-16 mx-auto text-destructive mb-4" />
          <h1 className="text-2xl font-bold mb-4">
            {isNetworkError ? "Connection Error" : "Booking Not Found"}
          </h1>
          <p className="text-muted-foreground mb-8">
            {isNetworkError
              ? "We couldn\u2019t reach the server. Please check your connection and try again."
              : "We couldn\u2019t find this booking. It may have expired or the link is invalid."}
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
  const isFailed = booking.status === "PAYMENT_FAILED";
  const isExpired = booking.status === "EXPIRED";

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
                  ? "A confirmation has been sent to your email and WhatsApp."
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
          ) : isFailed ? (
            <>
              <div className="h-20 w-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
                <XCircle className="h-10 w-10 text-red-600" />
              </div>
              <h1 className="text-3xl font-bold mb-2">Payment Failed</h1>
              <p className="text-muted-foreground">
                Your payment could not be processed. Please try again or use a different payment method.
              </p>
            </>
          ) : isExpired ? (
            <>
              <div className="h-20 w-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="h-10 w-10 text-gray-500" />
              </div>
              <h1 className="text-3xl font-bold mb-2">Booking Expired</h1>
              <p className="text-muted-foreground">
                This booking has expired. Please create a new booking.
              </p>
            </>
          ) : isRequested ? (
            <>
              <div className="h-20 w-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="h-10 w-10 text-blue-600" />
              </div>
              <h1 className="text-3xl font-bold mb-2">Request Submitted!</h1>
              <p className="text-muted-foreground">
                We&apos;ll review your request and contact you within 24 hours.
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
                {booking.spaceRequest.purpose && (
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium">Purpose</p>
                      <p className="text-sm text-muted-foreground">
                        {booking.spaceRequest.purpose}
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Status</p>
                    <p className="text-sm text-muted-foreground">
                      {booking.spaceRequest.status === "REQUESTED"
                        ? "Under Review"
                        : booking.spaceRequest.status.replace(/_/g, " ")}
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

        {/* Payment Section (for pending payments) */}
        {isPending && (
          <Card className="mb-6 border-yellow-500">
            <CardHeader>
              <CardTitle>Complete Payment</CardTitle>
              <CardDescription>
                Your booking will be confirmed once payment is received.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pollTimedOut && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-blue-800">
                    <strong>Verification is taking longer than usual.</strong> If you&apos;ve already paid,
                    your booking will be confirmed shortly. You can refresh this page to check.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      setPollCount(0);
                      refetch();
                    }}
                  >
                    <RefreshCw className="mr-2 h-3 w-3" />
                    Refresh Status
                  </Button>
                </div>
              )}
              {!pollTimedOut && !isPaymentLoading && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-4">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Checking payment status...
                </div>
              )}
              <Button
                className="w-full"
                disabled={isPaymentLoading || !accessToken}
                onClick={() => initiatePayment(booking.id, accessToken!)}
              >
                {isPaymentLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Opening Payment...
                  </>
                ) : (
                  `Pay ${booking.amountPaise ? formatPrice(booking.amountPaise) : ""}`
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground mt-2">
                Secure payment via Razorpay (UPI, Cards, Net Banking)
              </p>
            </CardContent>
          </Card>
        )}

        {/* Retry Payment (for failed payments) */}
        {isFailed && (
          <Card className="mb-6 border-red-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                Payment Failed
              </CardTitle>
              <CardDescription>
                Don&apos;t worry, no money was deducted. You can try again.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full"
                onClick={() => {
                  const returnUrl = isClass ? "/classes" : "/events";
                  window.location.href = returnUrl;
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Book Again
              </Button>
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
                    <span>You'll receive a confirmation email and WhatsApp message with all details</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>Arrive on time - the venue address is in your confirmation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>Bring your booking ID for verification at the entrance</span>
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
              {isFailed && (
                <>
                  <li className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
                    <span>No money was deducted from your account</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <RefreshCw className="h-4 w-4 text-red-500 mt-0.5" />
                    <span>You can create a new booking and try again</span>
                  </li>
                </>
              )}
              {isExpired && (
                <li className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-gray-500 mt-0.5" />
                  <span>Please create a new booking to proceed</span>
                </li>
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

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="container py-12">
        <div className="max-w-lg mx-auto text-center">
          <Loader2 className="h-16 w-16 mx-auto text-primary animate-spin mb-4" />
          <h1 className="text-2xl font-bold mb-2">Loading...</h1>
        </div>
      </div>
    }>
      <SuccessPageContent />
    </Suspense>
  );
}
