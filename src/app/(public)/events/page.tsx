"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, MapPin, Users, Loader2, AlertCircle, Ticket, ArrowRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { WHATSAPP_CONTACT_NUMBER } from "@/lib/constants";
import type { Event } from "@/types";

// Video URL from Supabase Storage
const HERO_VIDEO_URL = "https://umxpjtfekclktbtomiaz.supabase.co/storage/v1/object/public/Assets/videos/classicaldance.mp4";

const COLLABORATOR_IMAGES = [
  "https://umxpjtfekclktbtomiaz.supabase.co/storage/v1/object/public/Assets/images/eventImg-2.png",
  "https://umxpjtfekclktbtomiaz.supabase.co/storage/v1/object/public/Assets/images/event_new_image_2.png",
  "https://umxpjtfekclktbtomiaz.supabase.co/storage/v1/object/public/Assets/images/event_page_new.png",
];

// Custom hook for intersection observer animations
const useInView = (threshold = 0.1) => {
  const ref = useRef<HTMLElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.unobserve(element);
        }
      },
      { threshold }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isInView };
};

// Animated Text Component with letter-by-letter reveal
const AnimatedText = ({ text, className, delay = 0, isVisible }: { text: string; className?: string; delay?: number; isVisible: boolean }) => {
  return (
    <span className={className}>
      {text.split('').map((char, index) => (
        <span
          key={index}
          className="inline-block transition-all duration-500 ease-out"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
            transitionDelay: `${delay + index * 30}ms`,
          }}
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </span>
  );
};

// Magnetic Button Component - follows mouse movement
const MagneticButton = ({ 
  children, 
  className, 
  onClick 
}: { 
  children: React.ReactNode; 
  className?: string; 
  onClick?: () => void;
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const button = buttonRef.current;
    if (!button) return;
    
    const rect = button.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    
    setPosition({ x: x * 0.2, y: y * 0.2 });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setPosition({ x: 0, y: 0 });
  }, []);

  return (
    <button
      ref={buttonRef}
      className={className}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        transition: position.x === 0 ? 'transform 0.3s ease-out' : 'none',
      }}
    >
      {children}
    </button>
  );
};

// Ripple Button Component - ripple effect on click
const RippleButton = ({ 
  children, 
  className, 
  onClick,
  disabled = false
}: { 
  children: React.ReactNode; 
  className?: string; 
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
}) => {
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([]);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();
    
    setRipples(prev => [...prev, { x, y, id }]);
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== id));
    }, 600);
    
    onClick?.(e);
  };

  return (
    <button 
      className={`${className} relative overflow-hidden`} 
      onClick={handleClick}
      disabled={disabled}
    >
      {ripples.map(ripple => (
        <span
          key={ripple.id}
          className="absolute bg-white/30 rounded-full pointer-events-none animate-ripple"
          style={{
            left: ripple.x,
            top: ripple.y,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}
      {children}
    </button>
  );
};

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
    weekday: "short",
    day: "numeric",
    month: "short",
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

const formatTime12FromDate = (d: Date): string => {
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
};

const formatEventSchedule = (event: Event): string => {
  const start = new Date(event.startsAt);
  if (!event.endsAt) {
    const day = start.toLocaleDateString("en-IN", { weekday: "long" });
    return `${day} · ${formatTime12FromDate(start)}`;
  }
  const end = new Date(event.endsAt);
  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) {
    const day = start.toLocaleDateString("en-IN", { weekday: "long" });
    return `${day} · ${formatTime12FromDate(start)} - ${formatTime12FromDate(end)}`;
  }
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${start.toLocaleDateString("en-IN", { month: "long" })} ${start.getDate()} - ${end.getDate()}, ${start.getFullYear()}`;
  }
  return `${start.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} - ${end.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;
};

const EventCard = ({
  event,
  onBook,
  index = 0,
  isVisible = true,
}: {
  event: Event;
  onBook: (event: Event) => void;
  index?: number;
  isVisible?: boolean;
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const effectiveEnd = event.endsAt ? new Date(event.endsAt) : new Date(event.startsAt);
  const isPast = effectiveEnd < new Date();
  const passesRemaining = event.capacity ? event.capacity - (event.passesIssued || 0) : null;
  const isSoldOut = passesRemaining !== null && passesRemaining <= 0;

  return (
    <div 
      className={`group relative aspect-[4/3] rounded-2xl overflow-hidden cursor-pointer transition-all duration-500 ease-out ${
        isHovered 
          ? "shadow-2xl shadow-black/30 scale-[1.02]" 
          : "shadow-lg"
      } ${isHovered && !isSoldOut && !isPast ? "ring-2 ring-white/50" : ""}`}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(40px)',
        transitionDelay: `${index * 100}ms`,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => !isPast && !isSoldOut && onBook(event)}
      role="button"
      tabIndex={0}
      aria-label={`Get pass for ${event.title}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          !isPast && !isSoldOut && onBook(event);
        }
      }}
    >
      {/* Background Image */}
      {event.imageUrl ? (
        <Image
          src={event.imageUrl}
          alt={event.title}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className={`object-cover transition-all duration-700 ease-out ${
            isHovered ? "scale-110 brightness-90" : "scale-100 brightness-100"
          }`}
        />
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-br from-sacred-burgundy/80 to-sacred-green/60 transition-all duration-500 ${
          isHovered ? "brightness-75" : "brightness-100"
        }`} />
      )}
      
      {/* Gradient Overlay - Always visible */}
      <div className={`absolute inset-0 transition-all duration-500 ${
        isHovered 
          ? "bg-black/60" 
          : "bg-gradient-to-t from-black/70 via-black/20 to-transparent"
      }`} />

      {/* Default Content - Title & Schedule at bottom */}
      <div className={`absolute bottom-0 left-0 right-0 p-5 transition-all duration-500 ${
        isHovered ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"
      }`}>
        <h3 className="text-white text-xl font-semibold mb-1 transition-transform duration-300 group-hover:translate-x-1">
          {event.title}
        </h3>
        <p className="text-white/80 text-sm">
          {formatEventSchedule(event)}
        </p>
      </div>

      {/* Hover Content - Full details */}
      <div className={`absolute inset-0 flex flex-col justify-between p-5 transition-all duration-500 ${
        isHovered ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}>
        {/* Top Section - Price & Status */}
        <div className="flex justify-between items-start">
          <span 
            className={`px-3 py-1 rounded-full text-sm font-medium transition-all duration-300 ${
              isPast 
                ? "bg-gray-500/80 text-white" 
                : isSoldOut 
                  ? "bg-red-500/80 text-white" 
                  : "bg-green-500/80 text-white"
            }`}
            style={{
              transform: isHovered ? 'translateY(0) scale(1)' : 'translateY(-10px) scale(0.9)',
              transitionDelay: '100ms',
            }}
          >
            {isPast ? "Past" : isSoldOut ? "Sold Out" : passesRemaining ? `${passesRemaining} passes left` : "Available"}
          </span>
          <span 
            className="bg-white/95 text-gray-900 px-3 py-1 rounded-full text-lg font-bold shadow-lg transition-all duration-300"
            style={{
              transform: isHovered ? 'translateY(0) scale(1)' : 'translateY(-10px) scale(0.9)',
              transitionDelay: '150ms',
            }}
          >
            {formatPrice(event.pricePaise)}
          </span>
        </div>

        {/* Bottom Section - Details & Book Button */}
        <div className="space-y-3">
          <div
            style={{
              transform: isHovered ? 'translateY(0)' : 'translateY(20px)',
              transition: 'transform 0.4s ease-out',
              transitionDelay: '100ms',
            }}
          >
            <h3 className="text-white text-xl font-semibold mb-1">
              {event.title}
            </h3>
            <p className="text-white/80 text-sm line-clamp-2">
              {event.description}
            </p>
          </div>

          <div 
            className="flex items-center gap-4 text-white/70 text-sm"
            style={{
              transform: isHovered ? 'translateY(0)' : 'translateY(20px)',
              transition: 'transform 0.4s ease-out',
              transitionDelay: '150ms',
            }}
          >
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>{formatEventSchedule(event)}</span>
            </div>
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              <span className="truncate max-w-[100px]">{event.venue}</span>
            </div>
            {event.capacity && (
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{event.passesIssued || 0}/{event.capacity}</span>
              </div>
            )}
          </div>

          <div
            style={{
              transform: isHovered ? 'translateY(0)' : 'translateY(20px)',
              transition: 'transform 0.4s ease-out',
              transitionDelay: '200ms',
            }}
          >
            <RippleButton
              className={`w-full py-2.5 rounded-lg font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                isSoldOut || isPast 
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed" 
                  : "bg-white text-gray-900 hover:bg-white/90 hover:shadow-lg"
              }`}
              disabled={isSoldOut || isPast}
              onClick={(e) => {
                e.stopPropagation();
                onBook(event);
              }}
            >
              {/* TODO: Re-enable when booking goes live */}
              {/* {isPast ? "Event Ended" : isSoldOut ? "Sold Out" : (
                <>
                  Get Pass
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </>
              )} */}
              {isPast ? "Event Ended" : isSoldOut ? "Sold Out" : "Enquire on WhatsApp"}
            </RippleButton>
          </div>
        </div>
      </div>
    </div>
  );
};

const EventCardSkeleton = () => (
  <div className="relative aspect-[4/3] rounded-2xl overflow-hidden">
    <Skeleton className="absolute inset-0" />
    <div className="absolute bottom-0 left-0 right-0 p-5 space-y-2">
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  </div>
);

export default function EventsPage() {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [collaboratorImgIndex, setCollaboratorImgIndex] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const eventsSection = useInView(0.1);

  const { data, isLoading, error } = useQuery({
    queryKey: ["events"],
    queryFn: api.getEvents,
  });

  // Trigger hero animations on mount
  useEffect(() => {
    const timer = setTimeout(() => setHeroLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Track mouse for parallax effects
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth - 0.5) * 20,
        y: (e.clientY / window.innerHeight - 0.5) * 20,
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCollaboratorImgIndex((prev) => (prev + 1) % COLLABORATOR_IMAGES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

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
    // TODO: Re-enable when booking goes live
    // setSelectedEvent(event);
    // setIsDialogOpen(true);
    const message = encodeURIComponent(`Hi! I'm interested in the "${event.title}" event. Could you share more details?`);
    window.open(`https://wa.me/${WHATSAPP_CONTACT_NUMBER}?text=${message}`, "_blank");
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
    <div>
      {/* Hero Section */}
      <section className="relative bg-[#FFE5EC] py-8 md:py-10">
        <div className="container px-4 flex justify-center">
          <div className="relative w-full max-w-[1414px] p-5 md:p-[40px] bg-[#FFE5EC] rounded-[24px] md:rounded-[40px]">
            <div className="relative overflow-hidden shadow-2xl w-full h-[280px] sm:h-[350px] md:h-[418px] lg:h-[498px] rounded-[24px] md:rounded-[40px] group">
              <img
                src="https://umxpjtfekclktbtomiaz.supabase.co/storage/v1/object/public/Assets/images/eventHero.png"
                alt="Classes background"
                className="absolute inset-0 h-full w-full object-cover scale-105 "
              />
              <div className="absolute inset-0 bg-gradient-to-b from-gray-500/60 to-black/60" />

              <div className="absolute inset-0 flex flex-col justify-center px-6 md:px-10 lg:px-16">
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-[600] text-white tracking-wide whitespace-nowrap">
                  <AnimatedText
                    text="Upcoming Events"
                    isVisible={heroLoaded}
                    className="block"
                  />
                </h1>
                <p
                  className={`mt-3 md:mt-4 text-sm md:text-base lg:text-lg text-white/90 max-w-md lg:max-w-lg font-light transition-all duration-1000 ease-out ${
                    heroLoaded
                      ? "opacity-100 translate-y-0 delay-500"
                      : "opacity-0 translate-y-8"
                  }`}
                  style={{ transitionDelay: "600ms" }}
                >
                  Join our exciting community events. Get your pass instantly
                  with QR code delivered to your WhatsApp!
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Events Section */}
      <section className="relative bg-[#E2F0CB] rounded-t-[24px] md:rounded-t-[40px] -mt-6 md:-mt-10 z-10 overflow-hidden">
        <div className="container relative px-8 sm:px-6 md:px-12 py-12 md:py-16 lg:py-24">
          {/* TREE  */}
          <img
            src="https://umxpjtfekclktbtomiaz.supabase.co/storage/v1/object/public/Assets/images/tree-1.png"
            alt="tree"
            className="hidden md:block absolute right-0 top-10 w-[380px] lg:w-[450px] xl:w-[520px] opacity-20 pointer-events-none select-none"
            aria-hidden="true"
          />

          <div className="flex flex-col lg:flex-row justify-between items-start gap-8 lg:gap-16 relative z-10">
            {/* Left Side - Info Blocks */}
            <div className="flex-1 max-w-2xl space-y-8 md:space-y-10">
              {/* About the Events */}
              <div>
                <h3 className="text-gray-900 text-base md:text-lg font-semibold mb-2">
                  About the Events
                </h3>
                <p className="text-gray-600 text-xs md:text-sm font-light leading-relaxed">
                  We host events that bring people together through art movement
                  conversation and culture. Some are planned in advance. Some
                  grow organically.
                </p>
              </div>

              {/* What You Will Find */}
              <div>
                <h3 className="text-gray-900 text-base md:text-lg font-semibold mb-2">
                  What You Will Find
                </h3>
                <p className="text-gray-600 text-xs md:text-sm font-light leading-relaxed">
                  Performances talks screenings exhibitions markets and
                  community led gatherings. Events are designed to be
                  participatory and welcoming.
                </p>
              </div>

              {/* Ongoing Gatherings */}
              <div>
                <h3 className="text-gray-900 text-base md:text-lg font-semibold mb-2">
                  Ongoing Gatherings
                </h3>
                <p className="text-gray-600 text-xs md:text-sm font-light leading-relaxed">
                  Recurring events that return through the year. These include
                  cultural evenings open sessions and seasonal celebrations.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Host an Event Section */}
      <section className=" relative w-full h-[400px] sm:h-[500px] md:h-[600px] lg:h-[712px]  rounded-t-[24px] md:rounded-t-[40px] -mt-6 md:-mt-10 z-10 overflow-hidden">
        {" "}
        {/* Background Image */}
        <img
          src="https://umxpjtfekclktbtomiaz.supabase.co/storage/v1/object/public/Assets/images/eventImg-1.png"
          alt="Classes background"
          className="absolute inset-0 h-full w-full object-cover scale-105 "
        />
        <div className="absolute inset-0 bg-gradient-to-b from-gray-500/60 to-black/60" />
        {/* Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-between px-4 py-16 md:py-24 lg:py-32">
          {/* Empty spacer for top */}
          <div />

          {/* Center Content */}
          <div className="text-center">
            <h2
              className="text-2xl sm:text-3xl md:text-4xl lg:text-[40px] font-medium text-white mb-4 md:mb-6"
              style={{
                opacity: heroLoaded ? 1 : 0,
                transform: heroLoaded ? "translateY(0)" : "translateY(20px)",
                transition: "all 0.7s ease-out",
                transitionDelay: "100ms",
              }}
            >
              Host an Event
            </h2>
            <p
              className="text-white/90 text-sm md:text-base max-w-xl mx-auto font-light leading-relaxed"
              style={{
                opacity: heroLoaded ? 1 : 0,
                transform: heroLoaded ? "translateY(0)" : "translateY(20px)",
                transition: "all 0.7s ease-out",
                transitionDelay: "200ms",
              }}
            >
              We welcome artists collectives and organisations to host events in
              the space.
              <br />
              Events are curated to align with the spirit of the campus.
            </p>
          </div>

          {/* CTA Buttons at Bottom */}
          <div
            className="w-full max-w-4xl flex flex-col sm:flex-row items-center justify-between gap-6 sm:gap-8 px-4 sm:px-8 md:px-16"
            style={{
              opacity: heroLoaded ? 1 : 0,
              transform: heroLoaded ? "translateY(0)" : "translateY(20px)",
              transition: "all 0.7s ease-out",
              transitionDelay: "300ms",
            }}
          >
            <a
              href="/book-space"
              className="group flex items-center gap-3 text-white text-sm md:text-base font-medium hover:text-white/80 transition-colors"
              tabIndex={0}
              aria-label="Host an Event"
            >
              Host an Event
              <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
            </a>
            <a
              href="/contact"
              className="group flex items-center gap-3 text-white text-sm md:text-base font-medium hover:text-white/80 transition-colors"
              tabIndex={0}
              aria-label="Enquire"
            >
              Enquire
              <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
            </a>
          </div>
        </div>
      </section>

      {/* Events Content Section */}
      <section
        ref={eventsSection.ref as React.RefObject<HTMLElement>}
        className={`relative bg-[#FFE5EC] z-10 transition-all duration-1000 ease-out -mt-8 py-14 rounded-t-[32px] ${
          eventsSection.isInView
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-12"
        }`}
      >
        <div className="container py-12 md:py-16">
          {/* Error */}
          {error && (
            <div className="text-center py-20">
              <AlertCircle className="mx-auto mb-4" size={40} />
              Failed to load events
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
              {[...Array(4)].map((_, i) => (
                <EventCardSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Dynamic events */}
          {!isLoading && events.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
              {events.map((event, index) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onBook={handleBook}
                  index={index}
                  isVisible={eventsSection.isInView}
                />
              ))}
            </div>
          )}

          {/* Empty */}
          {!isLoading && events.length === 0 && (
            <div className="text-center py-20">No upcoming events</div>
          )}
        </div>
      </section>

      {/* Collaborators Section */}
      <section className="relative bg-[#C7D4A6] - mt-8 md:-mt-10 z-10 rounded-t-[32px] md:rounded-t-[48px] flex justify-center py-14 md:py-20">
        {/* centered container */}
        <div className="w-full max-w-[1400px] px-4">
          <div className=" px-6 sm:px-10 md:px-20 lg:px-28 py-12 md:py-20">
            <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 md:gap-20 items-center">
              {/* LEFT CONTENT */}
              <div className="text-center md:text-left max-w-md mx-auto md:mx-0">
                <h2 className="text-2xl md:text-3xl font-semibold mb-8">
                  Collaborators
                </h2>

                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold text-lg">Theatre Workshop</h3>
                    <p className="text-black/70 text-sm">By Bhoomika</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-lg">Weavers Market</h3>
                    <p className="text-black/70 text-sm">With local artisans</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-lg">Adivaram Angadi</h3>
                    <p className="text-black/70 text-sm">With various brands</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-lg">Moving Screening</h3>
                    <p className="text-black/70 text-sm">With Moving Images</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-lg">Vegan Market</h3>
                    <p className="text-black/70 text-sm">
                      With Plantarium Vegan Space
                    </p>
                  </div>
                </div>
              </div>

              {/* RIGHT IMAGE CAROUSEL */}
              <div className="relative flex justify-center md:justify-end">
                <div className="relative w-full max-w-[520px] h-[300px] md:h-[380px] rounded-[28px] md:rounded-[36px] overflow-hidden">
                  {COLLABORATOR_IMAGES.map((src, i) => (
                    <img
                      key={src + i}
                      src={src}
                      alt={`collaborators ${i + 1}`}
                      className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out"
                      style={{ opacity: collaboratorImgIndex === i ? 1 : 0 }}
                    />
                  ))}
                  <div className="absolute inset-0 bg-gradient-to-b from-gray-500/60 to-black/60" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* Booking Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Get Pass for {selectedEvent?.title}</DialogTitle>
            <DialogDescription asChild>
              <div>
                {selectedEvent ? (
                  <>
                    {formatDate(selectedEvent.startsAt)} at{" "}
                    {formatTime(selectedEvent.startsAt)}
                    <br />
                    <span className="text-muted-foreground">
                      {selectedEvent.venue}
                    </span>
                    <br />
                    <span className="font-semibold text-primary">
                      {formatPrice(selectedEvent.pricePaise)}
                    </span>
                  </>
                ) : (
                  <span>Loading event details...</span>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-4"
            >
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
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        {...field}
                      />
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
