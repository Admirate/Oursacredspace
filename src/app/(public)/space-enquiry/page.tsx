"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Clock, Loader2, CheckCircle2, MapPin, Info, ArrowLeft } from "lucide-react";
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
// TODO: Re-enable when booking goes live
// import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { WHATSAPP_CONTACT_NUMBER } from "@/lib/constants";

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

export default function SpaceEnquiryPage() {
  // TODO: Re-enable when booking goes live
  // const [isSuccess, setIsSuccess] = useState(false);
  // const { toast } = useToast();

  // const form = useForm<SpaceBookingFormData>({
  //   resolver: zodResolver(spaceBookingSchema),
  //   defaultValues: {
  //     customerName: "",
  //     customerEmail: "",
  //     customerPhone: "",
  //     purpose: "",
  //     attendees: "",
  //     specialRequirements: "",
  //   },
  // });

  // const bookingMutation = useMutation({
  //   mutationFn: api.createBooking,
  //   onSuccess: () => {
  //     setIsSuccess(true);
  //     toast({
  //       title: "Request Submitted!",
  //       description: "We'll contact you within 24 hours to confirm your booking.",
  //     });
  //   },
  //   onError: (error: Error) => {
  //     toast({
  //       title: "Submission Failed",
  //       description: error.message,
  //       variant: "destructive",
  //     });
  //   },
  // });

  // const handleSubmit = (formData: SpaceBookingFormData) => {
  //   const preferredDateTime = new Date(formData.preferredDate);
  //   const [hours, minutes] = formData.preferredTime.split(":");
  //   const isPM = formData.preferredTime.includes("PM");
  //   let hour = parseInt(hours);
  //   if (isPM && hour !== 12) hour += 12;
  //   if (!isPM && hour === 12) hour = 0;
  //   preferredDateTime.setHours(hour, parseInt(minutes) || 0);
  //   const preferredSlot = `${preferredDateTime.toISOString()} (${formData.duration} hours)`;
  //   const notesParts = [];
  //   if (formData.attendees) notesParts.push(`Expected attendees: ${formData.attendees}`);
  //   if (formData.specialRequirements) notesParts.push(`Special requirements: ${formData.specialRequirements}`);
  //   bookingMutation.mutate({
  //     type: "SPACE",
  //     name: formData.customerName,
  //     email: formData.customerEmail,
  //     phone: `+91${formData.customerPhone}`,
  //     preferredSlots: [preferredSlot],
  //     purpose: formData.purpose,
  //     notes: notesParts.length > 0 ? notesParts.join(". ") : undefined,
  //   });
  // };

  // TODO: Re-enable success state when booking goes live
  // if (isSuccess) {
  //   return (
  //     <div className="container py-12">
  //       <div className="max-w-lg mx-auto text-center">
  //         <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
  //           <CheckCircle2 className="h-10 w-10 text-green-600" />
  //         </div>
  //         <h1 className="text-3xl font-bold mb-4">Request Submitted!</h1>
  //         <p className="text-muted-foreground mb-8">
  //           Thank you for your interest in booking our space. Our team will review 
  //           your request and contact you within 24 hours to confirm availability 
  //           and discuss details.
  //         </p>
  //         <div className="bg-muted rounded-lg p-6 text-left mb-8">
  //           <h3 className="font-semibold mb-3">What happens next?</h3>
  //           <ol className="space-y-2 text-sm text-muted-foreground">
  //             <li>1. Our team reviews your request</li>
  //             <li>2. We'll call/WhatsApp you to confirm availability</li>
  //             <li>3. Once confirmed, you'll receive payment details</li>
  //             <li>4. After payment, your booking is confirmed!</li>
  //           </ol>
  //         </div>
  //         <div className="flex flex-col sm:flex-row gap-4 justify-center">
  //           <Button onClick={() => setIsSuccess(false)} variant="outline">
  //             Submit Another Request
  //           </Button>
  //           <Button asChild>
  //             <Link href="/book-space">Back to Spaces</Link>
  //           </Button>
  //         </div>
  //       </div>
  //     </div>
  //   );
  // }

  const handleWhatsAppEnquiry = () => {
    const message = encodeURIComponent("Hi! I'm interested in booking your space. Could you share availability and pricing details?");
    window.open(`https://wa.me/${WHATSAPP_CONTACT_NUMBER}?text=${message}`, "_blank");
  };

  return (
    <div className="container py-12">
      {/* Back Link */}
      <Link 
        href="/book-space" 
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Spaces
      </Link>

      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Space Enquiry</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Reserve our creative space for your meetings, workshops, events, or 
          personal projects. Submit a request and we'll get back to you within 24 hours.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {/* TODO: Re-enable form when booking goes live */}
        {/* WhatsApp CTA - replaces form temporarily */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Book Our Space</CardTitle>
              <CardDescription>
                Interested in reserving our space? Reach out to us on WhatsApp and we'll help you find the perfect slot.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center text-center py-8 space-y-6">
              <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <div className="space-y-2 max-w-md">
                <h3 className="text-xl font-semibold">Chat with us on WhatsApp</h3>
                <p className="text-muted-foreground text-sm">
                  Tell us about your requirements — preferred date, time, duration, and purpose — and we'll get back to you with availability and pricing.
                </p>
              </div>
              <Button
                size="lg"
                className="w-full max-w-xs"
                onClick={handleWhatsAppEnquiry}
              >
                Enquire on WhatsApp
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Info Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Space Features
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {SPACE_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-center text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Availability
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><strong>Monday - Friday:</strong> 9 AM - 9 PM</p>
              <p><strong>Saturday:</strong> 10 AM - 6 PM</p>
              <p><strong>Sunday:</strong> By appointment</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" />
                Pricing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Pricing varies based on duration and requirements. We'll share a quote when we contact you.</p>
              <p className="font-medium text-foreground">Starting from ₹500/hour</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
