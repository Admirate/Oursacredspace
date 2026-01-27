"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Search, 
  Calendar, 
  MapPin, 
  User,
  Ticket,
  Clock,
  AlertTriangle
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";

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

function VerifyPageContent() {
  const searchParams = useSearchParams();
  const initialPassId = searchParams.get("passId") || "";
  const [passId, setPassId] = useState(initialPassId);
  const [searchPassId, setSearchPassId] = useState(initialPassId);

  const { data, isLoading, error, isFetched } = useQuery({
    queryKey: ["verifyPass", searchPassId],
    queryFn: () => api.verifyPass(searchPassId),
    enabled: !!searchPassId && searchPassId.length > 5,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (passId.trim()) {
      setSearchPassId(passId.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch(e);
    }
  };

  const result = data?.data;
  const isValid = result?.valid;
  const pass = result?.pass;
  const event = result?.event;
  const isCheckedIn = pass?.checkInStatus === "CHECKED_IN";

  return (
    <div className="container py-12">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Verify Event Pass</h1>
          <p className="text-muted-foreground">
            Enter a pass ID to verify its authenticity and check-in status
          </p>
        </div>

        {/* Search Form */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Enter Pass ID (e.g., OSS-EV-XXXXXXXX)"
                  value={passId}
                  onChange={(e) => setPassId(e.target.value.toUpperCase())}
                  onKeyDown={handleKeyDown}
                  className="pl-10"
                  aria-label="Pass ID"
                />
              </div>
              <Button type="submit" disabled={!passId.trim() || isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Verify"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-8">
            <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">Verifying pass...</p>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <Card className="border-destructive">
            <CardContent className="pt-6 text-center">
              <XCircle className="h-16 w-16 mx-auto text-destructive mb-4" />
              <h2 className="text-xl font-semibold mb-2">Verification Failed</h2>
              <p className="text-muted-foreground">
                Unable to verify this pass. Please check the pass ID and try again.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Result - Invalid Pass */}
        {isFetched && !isLoading && !error && result && !isValid && (
          <Card className="border-destructive">
            <CardContent className="pt-6 text-center">
              <XCircle className="h-16 w-16 mx-auto text-destructive mb-4" />
              <h2 className="text-xl font-semibold mb-2">Invalid Pass</h2>
              <p className="text-muted-foreground">
                This pass ID is not valid or does not exist in our system.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Result - Valid Pass */}
        {isFetched && !isLoading && !error && result && isValid && pass && event && (
          <Card className={isCheckedIn ? "border-yellow-500" : "border-green-500"}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isCheckedIn ? (
                    <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
                      <AlertTriangle className="h-6 w-6 text-yellow-600" />
                    </div>
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                    </div>
                  )}
                  <div>
                    <CardTitle className={isCheckedIn ? "text-yellow-700" : "text-green-700"}>
                      {isCheckedIn ? "Already Checked In" : "Valid Pass"}
                    </CardTitle>
                    <CardDescription>
                      {isCheckedIn 
                        ? "This pass has already been used for entry" 
                        : "This pass is authentic and ready for use"
                      }
                    </CardDescription>
                  </div>
                </div>
                <Badge variant={isCheckedIn ? "outline" : "default"} className={isCheckedIn ? "border-yellow-500 text-yellow-600" : ""}>
                  {isCheckedIn ? "Used" : "Active"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Pass ID */}
              <div className="bg-muted rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">Pass ID</p>
                <p className="text-xl font-mono font-bold">{pass.passId}</p>
              </div>

              <Separator />

              {/* Event Details */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Ticket className="h-4 w-4 text-primary" />
                  Event Details
                </h3>
                <div className="pl-6 space-y-2">
                  <p className="font-medium text-lg">{event.title}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {formatDate(event.startsAt)} at {formatTime(event.startsAt)}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    {event.venue}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Attendee Details */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  Attendee
                </h3>
                <div className="pl-6">
                  <p className="font-medium">{result.attendeeName}</p>
                </div>
              </div>

              {/* Check-in Info */}
              {isCheckedIn && pass.checkInTime && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      Check-in Information
                    </h3>
                    <div className="pl-6 space-y-1 text-sm">
                      <p>
                        <span className="text-muted-foreground">Checked in at:</span>{" "}
                        {formatDate(pass.checkInTime)} at {formatTime(pass.checkInTime)}
                      </p>
                      {pass.checkedInBy && (
                        <p>
                          <span className="text-muted-foreground">By:</span> {pass.checkedInBy}
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Initial State */}
        {!searchPassId && !isLoading && (
          <div className="text-center py-8 text-muted-foreground">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Enter a pass ID above to verify</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="container py-12">
        <div className="max-w-xl mx-auto text-center">
          <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <VerifyPageContent />
    </Suspense>
  );
}
