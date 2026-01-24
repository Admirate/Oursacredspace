"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, MapPin, Users, Loader2, AlertCircle, Ticket } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import type { Event } from "@/types";

const bookingFormSchema = z.object({
  customerName: z.string().min(2, "Name must be at least 2 characters"),
  customerEmail: z.string().email("Please enter a valid email"),
  customerPhone: z.string().regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit Indian mobile number"),
});

type BookingFormData = z.infer<typeof bookingFormSchema>;

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

const EventCard = ({
  event,
  onBook,
}: {
  event: Event;
  onBook: (event: Event) => void;
}) => {
  const isPast = new Date(event.startsAt) < new Date();
  const passesRemaining = event.capacity ? event.capacity - (event.passesIssued || 0) : null;
  const isSoldOut = passesRemaining !== null && passesRemaining <= 0;

  return (
    <Card className="flex flex-col transition-all hover:shadow-lg hover:border-primary/50">
      <CardHeader>
        <div className="flex justify-between items-start mb-2">
          <Badge variant={isPast ? "outline" : isSoldOut ? "secondary" : "default"}>
            {isPast ? "Past Event" : isSoldOut ? "Sold Out" : passesRemaining ? `${passesRemaining} passes left` : "Available"}
          </Badge>
          <span className="text-2xl font-bold text-primary">
            {formatPrice(event.pricePaise)}
          </span>
        </div>
        <CardTitle className="text-xl">{event.title}</CardTitle>
        <CardDescription className="line-clamp-2">{event.description}</CardDescription>
      </CardHeader>

      <CardContent className="flex-1">
        <div className="space-y-3 text-sm">
          <div className="flex items-center text-muted-foreground">
            <Calendar className="h-4 w-4 mr-2 text-primary" />
            {formatDate(event.startsAt)}
          </div>
          <div className="flex items-center text-muted-foreground">
            <Ticket className="h-4 w-4 mr-2 text-primary" />
            {formatTime(event.startsAt)}
          </div>
          <div className="flex items-center text-muted-foreground">
            <MapPin className="h-4 w-4 mr-2 text-primary" />
            {event.venue}
          </div>
          {event.capacity && (
            <div className="flex items-center text-muted-foreground">
              <Users className="h-4 w-4 mr-2 text-primary" />
              {event.passesIssued || 0}/{event.capacity} attending
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter>
        <Button
          className="w-full"
          disabled={isPast || isSoldOut}
          onClick={() => onBook(event)}
        >
          {isPast ? "Event Ended" : isSoldOut ? "Sold Out" : "Get Pass"}
        </Button>
      </CardFooter>
    </Card>
  );
};

const EventCardSkeleton = () => (
  <Card className="flex flex-col">
    <CardHeader>
      <div className="flex justify-between items-start mb-2">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-8 w-16" />
      </div>
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-full mt-2" />
    </CardHeader>
    <CardContent className="flex-1 space-y-3">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-4 w-32" />
    </CardContent>
    <CardFooter>
      <Skeleton className="h-10 w-full" />
    </CardFooter>
  </Card>
);

export default function EventsPage() {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["events"],
    queryFn: api.getEvents,
  });

  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      customerName: "",
      customerEmail: "",
      customerPhone: "",
    },
  });

  const bookingMutation = useMutation({
    mutationFn: api.createBooking,
    onSuccess: (response) => {
      toast({
        title: "Pass Reserved!",
        description: "Redirecting to payment...",
      });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setIsDialogOpen(false);
      form.reset();
      window.location.href = `/success?bookingId=${response.data.bookingId}`;
    },
    onError: (error: Error) => {
      toast({
        title: "Booking Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleBook = (event: Event) => {
    setSelectedEvent(event);
    setIsDialogOpen(true);
  };

  const handleSubmit = (formData: BookingFormData) => {
    if (!selectedEvent) return;

    bookingMutation.mutate({
      type: "EVENT",
      eventId: selectedEvent.id,
      name: formData.customerName,
      email: formData.customerEmail,
      phone: `+91${formData.customerPhone}`,
    });
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setSelectedEvent(null);
    form.reset();
  };

  const events = data?.data || [];

  return (
    <div className="container py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Upcoming Events</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Join our exciting community events. Get your pass instantly with QR code 
          delivered to your WhatsApp!
        </p>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="h-16 w-16 text-destructive mb-4" />
          <h3 className="text-xl font-semibold mb-2">Failed to load events</h3>
          <p className="text-muted-foreground mb-4">
            Please try again later or contact support.
          </p>
          <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["events"] })}>
            Try Again
          </Button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <EventCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Events Grid */}
      {!isLoading && !error && events.length > 0 && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <EventCard key={event.id} event={event} onBook={handleBook} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && events.length === 0 && (
        <div className="text-center py-16">
          <Ticket className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No events scheduled</h3>
          <p className="text-muted-foreground">
            Check back soon for upcoming events and experiences.
          </p>
        </div>
      )}

      {/* Booking Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Get Pass for {selectedEvent?.title}</DialogTitle>
            <DialogDescription>
              {selectedEvent && (
                <>
                  {formatDate(selectedEvent.startsAt)} at {formatTime(selectedEvent.startsAt)}
                  <br />
                  <span className="text-muted-foreground">{selectedEvent.venue}</span>
                  <br />
                  <span className="font-semibold text-primary">
                    {formatPrice(selectedEvent.pricePaise)}
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter your full name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customerEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="you@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customerPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WhatsApp Number</FormLabel>
                    <FormControl>
                      <div className="flex">
                        <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground text-sm">
                          +91
                        </span>
                        <Input
                          className="rounded-l-none"
                          placeholder="9876543210"
                          maxLength={10}
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground">
                      Your QR pass will be sent to this WhatsApp number
                    </p>
                  </FormItem>
                )}
              />

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={handleDialogClose}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={bookingMutation.isPending}
                >
                  {bookingMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Get Pass"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
