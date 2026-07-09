"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Clock, Loader2, CheckCircle2, MapPin, Info, ArrowLeft, Sparkles } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const spaceBookingSchema = z.object({
  customerName: z.string().min(2, "Name must be at least 2 characters"),
  customerEmail: z.string().email("Please enter a valid email"),
  customerPhone: z.string().regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit Indian mobile number"),
  preferredDate: z.date({ required_error: "Please select a preferred date" }),
  preferredTime: z.string({ required_error: "Please select a preferred time" }),
  duration: z.string({ required_error: "Please select duration" }),
  purpose: z.string().min(10, "Please describe your purpose in at least 10 characters"),
  attendees: z.string().optional(),
  specialRequirements: z.string().optional(),
});

type SpaceBookingFormData = z.infer<typeof spaceBookingSchema>;

const TIME_SLOTS = [
  "09:00 AM",
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "01:00 PM",
  "02:00 PM",
  "03:00 PM",
  "04:00 PM",
  "05:00 PM",
  "06:00 PM",
  "07:00 PM",
];

const DURATION_OPTIONS = [
  { value: "1", label: "1 hour" },
  { value: "2", label: "2 hours" },
  { value: "3", label: "3 hours" },
  { value: "4", label: "4 hours (Half day)" },
  { value: "8", label: "8 hours (Full day)" },
];

const SPACE_FEATURES = [
  "Modern coworking environment",
  "High-speed WiFi",
  "Projector & screen",
  "Whiteboard",
  "Air conditioning",
  "Tea/Coffee available",
  "Parking available",
  "Accessible entrance",
];

// Thin brand gradient bar that sits flush at the top edge of a Card.
const AccentBar = () => (
  <div className="h-1.5 w-full bg-gradient-to-r from-sacred-green via-sacred-burgundy to-sacred-green" />
);

export default function SpaceEnquiryPage() {
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();

  const form = useForm<SpaceBookingFormData>({
    resolver: zodResolver(spaceBookingSchema),
    defaultValues: {
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      purpose: "",
      attendees: "",
      specialRequirements: "",
    },
  });

  const bookingMutation = useMutation({
    mutationFn: api.createBooking,
    onSuccess: () => {
      setIsSuccess(true);
      toast({
        title: "Request Submitted!",
        description: "We'll contact you within 24 hours to confirm your booking.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (formData: SpaceBookingFormData) => {
    const preferredDateTime = new Date(formData.preferredDate);
    const [hours, minutes] = formData.preferredTime.split(":");
    const isPM = formData.preferredTime.includes("PM");
    let hour = parseInt(hours);
    if (isPM && hour !== 12) hour += 12;
    if (!isPM && hour === 12) hour = 0;
    preferredDateTime.setHours(hour, parseInt(minutes) || 0);
    const preferredSlot = `${preferredDateTime.toISOString()} (${formData.duration} hours)`;
    const notesParts = [];
    if (formData.attendees) notesParts.push(`Expected attendees: ${formData.attendees}`);
    if (formData.specialRequirements) notesParts.push(`Special requirements: ${formData.specialRequirements}`);
    bookingMutation.mutate({
      type: "SPACE",
      name: formData.customerName,
      email: formData.customerEmail,
      phone: `+91${formData.customerPhone}`,
      preferredSlots: [preferredSlot],
      purpose: formData.purpose,
      notes: notesParts.length > 0 ? notesParts.join(". ") : undefined,
    });
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sacred-cream via-sacred-pink/10 to-white">
        <div className="container py-12 md:py-16">
          <div className="max-w-lg mx-auto text-center">
            <div className="h-24 w-24 rounded-full bg-sacred-green/10 ring-8 ring-sacred-green/5 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-12 w-12 text-sacred-green" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-4 text-sacred-burgundy">Request Submitted!</h1>
            <p className="text-muted-foreground mb-8">
              Thank you for your interest in booking our space. Our team will review
              your request and contact you within 24 hours to confirm availability
              and discuss details.
            </p>
            <Card className="overflow-hidden border-sacred-cream-dark text-left mb-8 shadow-sm">
              <AccentBar />
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4 text-sacred-burgundy">What happens next?</h3>
                <ol className="space-y-3 text-sm">
                  {[
                    "Our team reviews your request",
                    "We'll call/WhatsApp you to confirm availability",
                    "Once confirmed, you'll receive payment details",
                    "After payment, your booking is confirmed!",
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-sacred-green text-xs font-semibold text-white">
                        {i + 1}
                      </span>
                      <span className="text-muted-foreground pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button onClick={() => setIsSuccess(false)} variant="outline" className="border-sacred-green text-sacred-green hover:bg-sacred-cream">
                Submit Another Request
              </Button>
              <Button asChild className="bg-sacred-green hover:bg-sacred-green-dark text-white">
                <Link href="/book-space">Back to Spaces</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sacred-cream via-sacred-pink/10 to-white">
      <div className="container py-12 md:py-16">
        {/* Back Link */}
        <Link
          href="/book-space"
          className="inline-flex items-center gap-2 text-sm text-sacred-green hover:text-sacred-green-dark mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Spaces
        </Link>

        {/* Header */}
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sacred-pink/20 px-4 py-1.5 text-sm font-medium text-sacred-burgundy mb-4">
            <Sparkles className="h-4 w-4" />
            Our Sacred Space
          </span>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-sacred-burgundy">Space Enquiry</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Reserve our creative space for your meetings, workshops, events, or
            personal projects. Submit a request and we&apos;ll get back to you within 24 hours.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <div className="lg:col-span-2">
            <Card className="overflow-hidden border-sacred-cream-dark shadow-sm">
              <AccentBar />
              <CardHeader>
                <CardTitle className="text-sacred-burgundy">Book Our Space</CardTitle>
                <CardDescription>
                  Fill in your details and preferences. We&apos;ll review your request and get back to you within 24 hours.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="customerName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter your full name" className="focus-visible:ring-sacred-green" {...field} />
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
                              <Input type="email" placeholder="you@example.com" className="focus-visible:ring-sacred-green" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="customerPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl>
                            <div className="flex">
                              <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-sacred-cream text-sacred-burgundy text-sm font-medium">
                                +91
                              </span>
                              <Input className="rounded-l-none focus-visible:ring-sacred-green" placeholder="9876543210" maxLength={10} {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="preferredDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Preferred Date</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      "w-full pl-3 text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    {field.value ? format(field.value, "PPP") : "Pick a date"}
                                    <CalendarIcon className="ml-auto h-4 w-4 text-sacred-green" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  disabled={(date) => date < new Date()}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="preferredTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Preferred Time</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="focus:ring-sacred-green">
                                  <SelectValue placeholder="Select time" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {TIME_SLOTS.map((slot) => (
                                  <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="duration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Duration</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="focus:ring-sacred-green">
                                <SelectValue placeholder="Select duration" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {DURATION_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="purpose"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Purpose</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Describe how you plan to use the space..." className="min-h-[100px] focus-visible:ring-sacred-green" {...field} />
                          </FormControl>
                          <FormDescription>
                            E.g., team meeting, workshop, photo shoot, private event
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="attendees"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Expected Attendees (optional)</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="e.g., 10" className="focus-visible:ring-sacred-green" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="specialRequirements"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Special Requirements (optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., projector, whiteboard" className="focus-visible:ring-sacred-green" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Button type="submit" className="w-full bg-sacred-green hover:bg-sacred-green-dark text-white" disabled={bookingMutation.isPending}>
                      {bookingMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        "Submit Enquiry"
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>

          {/* Info Sidebar */}
          <div className="space-y-6">
            <Card className="overflow-hidden border-sacred-cream-dark shadow-sm">
              <AccentBar />
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sacred-burgundy">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sacred-green/10">
                    <MapPin className="h-5 w-5 text-sacred-green" />
                  </span>
                  Space Features
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2.5">
                  {SPACE_FEATURES.map((feature) => (
                    <li key={feature} className="flex items-center text-sm">
                      <CheckCircle2 className="h-4 w-4 text-sacred-green mr-2 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-sacred-cream-dark shadow-sm">
              <AccentBar />
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sacred-burgundy">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sacred-green/10">
                    <Clock className="h-5 w-5 text-sacred-green" />
                  </span>
                  Availability
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><strong className="text-sacred-burgundy">Monday - Friday:</strong> 9 AM - 9 PM</p>
                <p><strong className="text-sacred-burgundy">Saturday:</strong> 10 AM - 6 PM</p>
                <p><strong className="text-sacred-burgundy">Sunday:</strong> By appointment</p>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-sacred-cream-dark shadow-sm bg-gradient-to-br from-sacred-green/5 to-sacred-cream">
              <AccentBar />
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sacred-burgundy">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sacred-green/10">
                    <Info className="h-5 w-5 text-sacred-green" />
                  </span>
                  Pricing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>Pricing varies based on duration and requirements. We&apos;ll share a quote when we contact you.</p>
                <p className="text-lg font-bold text-sacred-green">Starting from ₹500/hour</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
