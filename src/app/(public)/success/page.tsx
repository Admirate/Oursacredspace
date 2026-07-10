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
  RefreshCw,
  Users,
  ShieldCheck
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { usePayment } from "@/hooks/usePayment";
import { api } from "@/lib/api";
import { readTokenFromUrlOrStore } from "@/lib/bookingToken";
import { POLLING_INTERVAL } from "@/lib/constants";
import { PaymentVerifyingOverlay } from "@/components/shared/PaymentVerifyingOverlay";

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

/** "4m 09s" — the seat hold remaining on an unpaid booking. */
const formatCountdown = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}m ${String(secs).padStart(2, "0")}s`;
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "CONFIRMED":
      return <Badge className="bg-sacred-green hover:bg-sacred-green">Confirmed</Badge>;
    case "PENDING_PAYMENT":
      return <Badge variant="outline" className="border-amber-500 text-amber-600">Pending Payment</Badge>;
    case "PAYMENT_FAILED":
      return <Badge variant="destructive">Payment Failed</Badge>;
    case "CANCELLED":
      return <Badge variant="destructive">Cancelled</Badge>;
    case "EXPIRED":
      return <Badge variant="outline" className="border-gray-400 text-gray-500">Expired</Badge>;
    case "REQUESTED":
      return <Badge className="bg-sacred-burgundy hover:bg-sacred-burgundy">Request Submitted</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

// Thin brand gradient bar that sits flush at the top edge of a Card.
const AccentBar = () => (
  <div className="h-1.5 w-full bg-gradient-to-r from-sacred-green via-sacred-burgundy to-sacred-green" />
);

// Shared page shell: soft cream → white wash so every state reads as one page.
const PageShell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-gradient-to-b from-sacred-cream via-sacred-pink/10 to-white">
    <div className="container py-12 md:py-16">{children}</div>
  </div>
);

const SUCCESS_POLL_MAX = 60;

function SuccessPageContent() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("bookingId");
  // SECURITY (SEC-005 / finding #7): the success page requires the per-booking
  // access token, but it must NOT live in the URL. In-app navigation stashes it
  // in sessionStorage; an emailed resume link carries it once in the URL, which
  // we consume and strip. `urlToken` is read only to hand it to the resolver.
  const urlToken = searchParams.get("token");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [tokenResolved, setTokenResolved] = useState(false);

  useEffect(() => {
    if (!bookingId) {
      setTokenResolved(true);
      return;
    }
    setAccessToken(readTokenFromUrlOrStore(bookingId, urlToken));
    setTokenResolved(true);
  }, [bookingId, urlToken]);

  const [pollCount, setPollCount] = useState(0);
  const pollTimedOut = pollCount >= SUCCESS_POLL_MAX;
  const { toast } = useToast();

  const { initiatePayment, isLoading: isPaymentLoading, isVerifying } = usePayment({
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

  // The seat hold is an absolute deadline on the row, so the client can render
  // it honestly instead of quoting a hard-coded duration. Polling stops after
  // SUCCESS_POLL_MAX ticks (~2 min), which used to leave a live "Pay" button on
  // a booking that had already expired server-side; this local clock keeps the
  // UI truthful regardless of whether we are still polling.
  const status = booking?.status;
  const holdExpiresAt = booking?.holdExpiresAt;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (status !== "PENDING_PAYMENT" || !holdExpiresAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [status, holdExpiresAt]);

  const holdMsLeft = holdExpiresAt ? new Date(holdExpiresAt).getTime() - now : null;
  const holdLapsed = holdMsLeft !== null && holdMsLeft <= 0;

  // The moment the hold lapses, ask the server for the real status so the page
  // settles on the authoritative "Expired" state rather than our local guess.
  useEffect(() => {
    if (holdLapsed && status === "PENDING_PAYMENT") refetch();
  }, [holdLapsed, status, refetch]);

  // The token is resolved in an effect (sessionStorage / URL), so on the very
  // first render it is legitimately still null. Show the loading state until
  // resolution completes to avoid flashing "No Booking Found".
  if (!tokenResolved) {
    return (
      <PageShell>
        <div className="max-w-lg mx-auto text-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-sacred-burgundy mx-auto" />
        </div>
      </PageShell>
    );
  }

  // No booking ID or no access token -> render the same "missing reference"
  // state. We deliberately do not distinguish between the two: a leaked
  // booking ID without a token must not produce a different UI than no ID
  // at all.
  if (!bookingId || !accessToken) {
    return (
      <PageShell>
        <div className="max-w-lg mx-auto text-center">
          <div className="h-20 w-20 rounded-full bg-sacred-cream-dark flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="h-10 w-10 text-sacred-burgundy" />
          </div>
          <h1 className="text-3xl font-bold mb-3 text-sacred-burgundy">No Booking Found</h1>
          <p className="text-muted-foreground mb-8">
            It looks like you accessed this page without a booking reference.
          </p>
          <Button asChild className="bg-sacred-green hover:bg-sacred-green-dark text-white">
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <PageShell>
        <div className="max-w-lg mx-auto text-center">
          <Loader2 className="h-16 w-16 mx-auto text-sacred-green animate-spin mb-4" />
          <h1 className="text-2xl font-bold mb-2 text-sacred-burgundy">Loading Booking...</h1>
          <p className="text-muted-foreground">Please wait while we fetch your booking details.</p>
        </div>
      </PageShell>
    );
  }

  // Error state — distinguish transient vs permanent
  if (error || !booking) {
    const isNetworkError = error?.message?.includes("connect") || error?.message?.includes("timed out");
    return (
      <PageShell>
        <div className="max-w-lg mx-auto text-center">
          <div className="h-20 w-20 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="h-10 w-10 text-destructive" />
          </div>
          <h1 className="text-3xl font-bold mb-3 text-sacred-burgundy">
            {isNetworkError ? "Connection Error" : "Booking Not Found"}
          </h1>
          <p className="text-muted-foreground mb-8">
            {isNetworkError
              ? "We couldn’t reach the server. Please check your connection and try again."
              : "We couldn’t find this booking. It may have expired or the link is invalid."}
          </p>
          <div className="flex gap-4 justify-center">
            <Button variant="outline" className="border-sacred-green text-sacred-green hover:bg-sacred-cream" onClick={() => refetch()}>
              Try Again
            </Button>
            <Button asChild className="bg-sacred-green hover:bg-sacred-green-dark text-white">
              <Link href="/">Go Home</Link>
            </Button>
          </div>
        </div>
      </PageShell>
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
    <PageShell>
      <PaymentVerifyingOverlay show={isVerifying} />
      <div className="max-w-2xl mx-auto">
        {/* Success Header */}
        <div className="text-center mb-10">
          {isConfirmed ? (
            <>
              <div className="h-24 w-24 rounded-full bg-sacred-green/10 ring-8 ring-sacred-green/5 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="h-12 w-12 text-sacred-green" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2 text-sacred-burgundy">Booking Confirmed!</h1>
              <p className="text-muted-foreground max-w-md mx-auto">
                {isEvent
                  ? "A confirmation has been sent to your email."
                  : "Your booking has been confirmed. See you soon!"
                }
              </p>
            </>
          ) : isPending ? (
            <>
              <div className="h-24 w-24 rounded-full bg-amber-100 ring-8 ring-amber-50 flex items-center justify-center mx-auto mb-6">
                <Clock className="h-12 w-12 text-amber-600" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2 text-sacred-burgundy">Complete Your Payment</h1>
              <p className="text-muted-foreground max-w-md mx-auto">
                Your booking is reserved. Please complete payment to confirm.
              </p>
            </>
          ) : isFailed ? (
            <>
              <div className="h-24 w-24 rounded-full bg-red-100 ring-8 ring-red-50 flex items-center justify-center mx-auto mb-6">
                <XCircle className="h-12 w-12 text-red-600" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2 text-sacred-burgundy">Payment Failed</h1>
              <p className="text-muted-foreground max-w-md mx-auto">
                Your payment could not be processed. Please try again or use a different payment method.
              </p>
            </>
          ) : isExpired ? (
            <>
              <div className="h-24 w-24 rounded-full bg-gray-100 ring-8 ring-gray-50 flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="h-12 w-12 text-gray-500" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2 text-sacred-burgundy">Booking Expired</h1>
              <p className="text-muted-foreground max-w-md mx-auto">
                This booking has expired. Please create a new booking.
              </p>
            </>
          ) : isRequested ? (
            <>
              <div className="h-24 w-24 rounded-full bg-sacred-pink/20 ring-8 ring-sacred-pink/10 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="h-12 w-12 text-sacred-burgundy" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2 text-sacred-burgundy">Request Submitted!</h1>
              <p className="text-muted-foreground max-w-md mx-auto">
                We&apos;ll review your request and contact you within 24 hours.
              </p>
            </>
          ) : (
            <>
              <div className="h-24 w-24 rounded-full bg-sacred-cream-dark ring-8 ring-sacred-cream flex items-center justify-center mx-auto mb-6">
                <Ticket className="h-12 w-12 text-sacred-green" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2 text-sacred-burgundy">Booking Details</h1>
            </>
          )}
        </div>

        {/* Booking Details Card */}
        <Card className="mb-6 overflow-hidden border-sacred-cream-dark shadow-sm">
          <AccentBar />
          <CardHeader>
            <div className="flex justify-between items-start gap-4">
              <div>
                <CardTitle className="text-sacred-burgundy">
                  {isClass && booking.classSession?.title}
                  {isEvent && booking.event?.title}
                  {isSpace && "Space Booking Request"}
                </CardTitle>
                <CardDescription className="mt-1">
                  Booking ID: <span className="font-mono font-medium text-foreground">{booking.id.slice(0, 8).toUpperCase()}</span>
                </CardDescription>
              </div>
              {getStatusBadge(booking.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Date & Time */}
            {(isClass || isEvent) && (
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-sacred-green/10 flex items-center justify-center flex-shrink-0">
                  <Calendar className="h-5 w-5 text-sacred-green" />
                </div>
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
                <div className="h-9 w-9 rounded-lg bg-sacred-green/10 flex items-center justify-center flex-shrink-0">
                  <MapPin className="h-5 w-5 text-sacred-green" />
                </div>
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
                    <div className="h-9 w-9 rounded-lg bg-sacred-green/10 flex items-center justify-center flex-shrink-0">
                      <Calendar className="h-5 w-5 text-sacred-green" />
                    </div>
                    <div>
                      <p className="font-medium">Purpose</p>
                      <p className="text-sm text-muted-foreground">
                        {booking.spaceRequest.purpose}
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-sacred-green/10 flex items-center justify-center flex-shrink-0">
                    <Clock className="h-5 w-5 text-sacred-green" />
                  </div>
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

            <Separator className="bg-sacred-cream-dark" />

            {/* Customer Details */}
            <div className="space-y-2">
              <p className="font-medium text-sacred-burgundy">{booking.customerName}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4 text-sacred-green" />
                {booking.customerEmail}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4 text-sacred-green" />
                {booking.customerPhone}
              </div>
            </div>

            {/* Seats (multi-seat bookings) */}
            {(isClass || isEvent) && (booking.quantity ?? 1) > 1 && (
              <div className="flex justify-between items-center">
                <span className="font-medium flex items-center gap-2">
                  <Users className="h-4 w-4 text-sacred-green" />
                  {isEvent ? "Passes" : "Seats"}
                </span>
                <span className="text-sm text-muted-foreground">{booking.quantity}</span>
              </div>
            )}

            {/* Price */}
            {booking.amountPaise && (
              <>
                <Separator className="bg-sacred-cream-dark" />
                <div className="flex justify-between items-center rounded-lg bg-sacred-cream px-4 py-3">
                  <span className="font-medium text-sacred-burgundy">Amount</span>
                  <span className="text-2xl font-bold text-sacred-green">
                    {formatPrice(booking.amountPaise)}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Payment Section (for pending payments) */}
        {isPending && (
          <Card className="mb-6 overflow-hidden border-amber-300 shadow-sm">
            <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 to-amber-500" />
            <CardHeader>
              <CardTitle className="text-sacred-burgundy">Complete Payment</CardTitle>
              <CardDescription>
                Your booking will be confirmed once payment is received.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pollTimedOut && (
                <div className="bg-sacred-cream border border-sacred-cream-dark rounded-lg p-4 mb-4">
                  <p className="text-sm text-sacred-burgundy">
                    <strong>Verification is taking longer than usual.</strong> If you&apos;ve already paid,
                    your booking will be confirmed shortly. You can refresh this page to check.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 border-sacred-green text-sacred-green hover:bg-sacred-cream-dark"
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
              {!pollTimedOut && !isPaymentLoading && !holdLapsed && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-4">
                  <Loader2 className="h-3 w-3 animate-spin text-sacred-green" />
                  Checking payment status...
                </div>
              )}
              {holdLapsed ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-700">
                    <strong>This booking has expired.</strong> We could not hold your
                    {isEvent ? " passes" : " seats"} any longer. Please book again — no
                    money was taken.
                  </p>
                  <Button
                    className="w-full mt-3 bg-sacred-green hover:bg-sacred-green-dark text-white"
                    onClick={() => {
                      window.location.href = isClass ? "/classes" : "/events";
                    }}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Book Again
                  </Button>
                </div>
              ) : (
                <>
                  <Button
                    className="w-full bg-sacred-green hover:bg-sacred-green-dark text-white"
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
                  {holdMsLeft !== null && (
                    <p className="text-xs text-center text-amber-700 mt-2">
                      {isEvent ? "Passes" : "Seats"} held for{" "}
                      <strong className="font-mono">{formatCountdown(holdMsLeft)}</strong>
                    </p>
                  )}
                  <p className="text-xs text-center text-muted-foreground mt-2 flex items-center justify-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-sacred-green" />
                    Secure payment via Razorpay (UPI, Cards, Net Banking)
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Retry Payment (for failed payments) */}
        {isFailed && (
          <Card className="mb-6 overflow-hidden border-red-300 shadow-sm">
            <div className="h-1.5 w-full bg-gradient-to-r from-red-400 to-red-500" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sacred-burgundy">
                <XCircle className="h-5 w-5 text-red-500" />
                Payment Failed
              </CardTitle>
              <CardDescription>
                Don&apos;t worry, no money was deducted. You can try again.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full bg-sacred-green hover:bg-sacred-green-dark text-white"
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
        <Card className="overflow-hidden border-sacred-cream-dark shadow-sm">
          <AccentBar />
          <CardHeader>
            <CardTitle className="text-sacred-burgundy">What&apos;s Next?</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              {isConfirmed && isClass && (
                <>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-sacred-green mt-0.5 flex-shrink-0" />
                    <span>You&apos;ll receive a confirmation email with all details</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-sacred-green mt-0.5 flex-shrink-0" />
                    <span>Arrive 10 minutes before the class starts</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-sacred-green mt-0.5 flex-shrink-0" />
                    <span>Bring your booking ID for verification</span>
                  </li>
                </>
              )}
              {isConfirmed && isEvent && (
                <>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-sacred-green mt-0.5 flex-shrink-0" />
                    <span>You&apos;ll receive a confirmation email with all details</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-sacred-green mt-0.5 flex-shrink-0" />
                    <span>Arrive on time - the venue address is in your confirmation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-sacred-green mt-0.5 flex-shrink-0" />
                    <span>Bring your booking ID for verification at the entrance</span>
                  </li>
                </>
              )}
              {isRequested && (
                <>
                  <li className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-sacred-burgundy mt-0.5 flex-shrink-0" />
                    <span>Our team will review your request within 24 hours</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Phone className="h-4 w-4 text-sacred-burgundy mt-0.5 flex-shrink-0" />
                    <span>We&apos;ll contact you via WhatsApp/call to confirm</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-sacred-burgundy mt-0.5 flex-shrink-0" />
                    <span>Once confirmed, you&apos;ll receive payment details</span>
                  </li>
                </>
              )}
              {isPending && (
                <>
                  <li className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>Complete your payment to confirm the booking</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    {/* The hold is an absolute deadline on the booking and can be
                        extended (e.g. by a resume-payment link), so quote the
                        real instant rather than a fixed duration. */}
                    <span>
                      {holdExpiresAt
                        ? `Your ${isEvent ? "passes are" : "seats are"} held until ${formatTime(holdExpiresAt)}`
                        : "Your booking is held until payment is completed"}
                    </span>
                  </li>
                </>
              )}
              {isFailed && (
                <>
                  <li className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>No money was deducted from your account</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <RefreshCw className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>You can create a new booking and try again</span>
                  </li>
                </>
              )}
              {isExpired && (
                <li className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                  <span>Please create a new booking to proceed</span>
                </li>
              )}
            </ul>
          </CardContent>
        </Card>

        {/* Back to Home */}
        <div className="text-center mt-8">
          <Button asChild variant="outline" className="border-sacred-green text-sacred-green hover:bg-sacred-cream">
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Back to Home
            </Link>
          </Button>
        </div>
      </div>
    </PageShell>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-sacred-cream via-sacred-pink/10 to-white">
        <div className="container py-12">
          <div className="max-w-lg mx-auto text-center">
            <Loader2 className="h-16 w-16 mx-auto text-sacred-green animate-spin mb-4" />
            <h1 className="text-2xl font-bold mb-2 text-sacred-burgundy">Loading...</h1>
          </div>
        </div>
      </div>
    }>
      <SuccessPageContent />
    </Suspense>
  );
}
