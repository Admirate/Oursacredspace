"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Clock, Users, Loader2, AlertCircle, ArrowRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import type { ClassSession } from "@/types";

// Video URL from Supabase Storage
const HERO_VIDEO_URL = "https://umxpjtfekclktbtomiaz.supabase.co/storage/v1/object/public/Assets/videos/classes.mp4";

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

// Animated Counter Component
const AnimatedCounter = ({ 
  target, 
  suffix = "", 
  isVisible 
}: { 
  target: number; 
  suffix?: string; 
  isVisible: boolean;
}) => {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    if (!isVisible) return;
    
    const duration = 2000;
    const steps = 60;
    const stepValue = target / steps;
    let current = 0;
    
    const timer = setInterval(() => {
      current += stepValue;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    
    return () => clearInterval(timer);
  }, [isVisible, target]);
  
  return <span>{count}{suffix}</span>;
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

// Format day and time for display
const formatSchedule = (date: string, duration: number): string => {
  const d = new Date(date);
  const day = d.toLocaleDateString("en-IN", { weekday: "long" });
  const startTime = d.toLocaleTimeString("en-IN", { 
    hour: "numeric", 
    minute: "2-digit",
    hour12: true 
  });
  
  // Calculate end time
  const endDate = new Date(d.getTime() + duration * 60000);
  const endTime = endDate.toLocaleTimeString("en-IN", { 
    hour: "numeric", 
    minute: "2-digit",
    hour12: true 
  });
  
  return `${day} · ${startTime} to ${endTime}`;
};

const ClassCard = ({
  classItem,
  onBook,
  index = 0,
  isVisible = true,
}: {
  classItem: ClassSession;
  onBook: (classItem: ClassSession) => void;
  index?: number;
  isVisible?: boolean;
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const spotsLeft = classItem.capacity - classItem.spotsBooked;
  const isFull = spotsLeft === 0;
  const isPast = new Date(classItem.startsAt) < new Date();

  return (
    <div 
      className={`group relative aspect-[4/3] rounded-2xl overflow-hidden cursor-pointer transition-all duration-500 ease-out ${
        isHovered 
          ? "shadow-2xl shadow-black/30 scale-[1.02]" 
          : "shadow-lg"
      } ${isHovered && !isFull && !isPast ? "ring-2 ring-white/50" : ""}`}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(40px)',
        transitionDelay: `${index * 100}ms`,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => !isPast && !isFull && onBook(classItem)}
      role="button"
      tabIndex={0}
      aria-label={`Book ${classItem.title}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          !isPast && !isFull && onBook(classItem);
        }
      }}
    >
      {/* Background Image */}
      {classItem.imageUrl ? (
        <Image
          src={classItem.imageUrl}
          alt={classItem.title}
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
          {classItem.title}
        </h3>
        <p className="text-white/80 text-sm">
          {formatSchedule(classItem.startsAt, classItem.duration)}
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
                : isFull 
                  ? "bg-red-500/80 text-white" 
                  : "bg-green-500/80 text-white"
            }`}
            style={{
              transform: isHovered ? 'translateY(0) scale(1)' : 'translateY(-10px) scale(0.9)',
              transitionDelay: '100ms',
            }}
          >
            {isPast ? "Past" : isFull ? "Fully Booked" : `${spotsLeft} spots left`}
          </span>
          <span 
            className="bg-white/95 text-gray-900 px-3 py-1 rounded-full text-lg font-bold shadow-lg transition-all duration-300"
            style={{
              transform: isHovered ? 'translateY(0) scale(1)' : 'translateY(-10px) scale(0.9)',
              transitionDelay: '150ms',
            }}
          >
            {formatPrice(classItem.pricePaise)}
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
              {classItem.title}
            </h3>
            <p className="text-white/80 text-sm line-clamp-2">
              {classItem.description}
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
              <span>{formatDate(classItem.startsAt)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>{classItem.spotsBooked}/{classItem.capacity}</span>
            </div>
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
                isFull || isPast 
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed" 
                  : "bg-white text-gray-900 hover:bg-white/90 hover:shadow-lg"
              }`}
              disabled={isFull || isPast}
              onClick={(e) => {
                e.stopPropagation();
                onBook(classItem);
              }}
            >
              {isPast ? "Class Ended" : isFull ? "Fully Booked" : (
                <>
                  Book Now
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </>
              )}
            </RippleButton>
          </div>
        </div>
      </div>
    </div>
  );
};

const ClassCardSkeleton = () => (
  <div className="relative aspect-[4/3] rounded-2xl overflow-hidden">
    <Skeleton className="absolute inset-0" />
    <div className="absolute bottom-0 left-0 right-0 p-5 space-y-2">
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  </div>
);

export default function ClassesPage() {
  const [selectedClass, setSelectedClass] = useState<ClassSession | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const classesSection = useInView(0.1);
  const communitySection = useInView(0.1);
  const visitSection = useInView(0.1);

  const { data, isLoading, error } = useQuery({
    queryKey: ["classes"],
    queryFn: api.getClasses,
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
        title: "Booking Created!",
        description: "Redirecting to payment...",
      });
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      setIsDialogOpen(false);
      form.reset();
      // Redirect to success or payment page
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

  const handleBook = (classItem: ClassSession) => {
    setSelectedClass(classItem);
    setIsDialogOpen(true);
  };

  const handleSubmit = (formData: BookingFormData) => {
    if (!selectedClass) return;

    bookingMutation.mutate({
      type: "CLASS",
      classSessionId: selectedClass.id,
      name: formData.customerName,
      email: formData.customerEmail,
      phone: `+91${formData.customerPhone}`,
    });
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setSelectedClass(null);
    form.reset();
  };

  const classes = data?.data || [];

  return (
    <div className="overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative bg-sacred-pink py-8 md:py-10">
        <div className="container px-4 flex justify-center">
          <div className="relative w-full max-w-[1414px] p-5 md:p-[40px] bg-sacred-pink rounded-[24px] md:rounded-[40px]">
            <div className="relative overflow-hidden shadow-2xl w-full h-[280px] sm:h-[350px] md:h-[418px] lg:h-[498px] rounded-[24px] md:rounded-[40px] group">
              <video
                autoPlay
                loop
                muted
                playsInline
                className="absolute inset-0 h-full w-full object-cover scale-105 transition-transform duration-2000 group-hover:scale-110"
                style={{
                  transform: `scale(1.05) translate(${mousePosition.x * 0.5}px, ${mousePosition.y * 0.5}px)`,
                }}
                aria-label="Classes video background"
              >
                <source src={HERO_VIDEO_URL} type="video/mp4" />
              </video>
              
              <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/30 to-transparent" />
              
              {/* Floating particles */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-2 h-2 bg-white/20 rounded-full animate-float"
                    style={{
                      left: `${15 + i * 15}%`,
                      top: `${20 + (i % 3) * 25}%`,
                      animationDelay: `${i * 0.5}s`,
                      animationDuration: `${3 + i * 0.5}s`,
                    }}
                  />
                ))}
              </div>
              
              <div className="absolute inset-0 flex flex-col justify-center px-6 md:px-10 lg:px-16">
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-light text-white italic tracking-wide">
                  <AnimatedText text="Our Classes" isVisible={heroLoaded} className="block" />
                </h1>
                <p 
                  className={`mt-3 md:mt-4 text-sm md:text-base lg:text-lg text-white/90 max-w-md lg:max-w-lg font-light transition-all duration-1000 ease-out ${
                    heroLoaded ? "opacity-100 translate-y-0 delay-500" : "opacity-0 translate-y-8"
                  }`}
                  style={{ transitionDelay: '600ms' }}
                >
                  Join our expert-led classes across dance, yoga, martial arts, and creative practices. 
                  Small batch sizes ensure personalized attention.
                </p>
                
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Classes Content Section */}
      <section 
        ref={classesSection.ref as React.RefObject<HTMLElement>}
        className={`relative bg-white rounded-t-[24px] md:rounded-t-[40px] -mt-6 md:-mt-10 z-10 transition-all duration-1000 ease-out ${
          classesSection.isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
        }`}
      >
        {/* Decorative Rotating Mandala Background */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <div className="relative w-[500px] h-[500px] md:w-[600px] md:h-[600px] animate-spin-slow">
            <Image
              src="https://umxpjtfekclktbtomiaz.supabase.co/storage/v1/object/public/Assets/images/wheel.png"
              alt=""
              aria-hidden="true"
              fill
              sizes="(max-width: 768px) 500px, 600px"
              className="object-contain opacity-20"
            />
          </div>
        </div>

        <div className="container relative py-12 md:py-16 lg:py-20">
          {/* Error State */}
          {error && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle className="h-16 w-16 text-destructive mb-4" />
              <h3 className="text-xl font-semibold mb-2">Failed to load classes</h3>
              <p className="text-muted-foreground mb-4">
                Please try again later or contact support.
              </p>
              <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["classes"] })}>
                Try Again
              </Button>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {[...Array(4)].map((_, i) => (
                <ClassCardSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Classes Grid */}
          {!isLoading && !error && classes.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {classes.map((classItem, index) => (
                <ClassCard
                  key={classItem.id}
                  classItem={classItem}
                  onBook={handleBook}
                  index={index}
                  isVisible={classesSection.isInView}
                />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && classes.length === 0 && (
            <div className="text-center py-16">
              <Calendar className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No classes available</h3>
              <p className="text-muted-foreground">
                Check back soon for upcoming classes and workshops.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Community and Culture Section */}
      <section 
        ref={communitySection.ref as React.RefObject<HTMLElement>}
        className="bg-white py-10 sm:py-12 md:py-16 lg:py-20"
      >
        <div className="container px-4 sm:px-6">
          <div 
            className="max-w-sm sm:max-w-md md:max-w-xl mx-auto text-center md:text-left md:mx-0 transition-all duration-700"
            style={{
              opacity: communitySection.isInView ? 1 : 0,
              transform: communitySection.isInView ? 'translateY(0)' : 'translateY(30px)',
            }}
          >
            <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-semibold text-gray-900 mb-3 sm:mb-4">
              Community and Culture
            </h2>
            <p 
              className="text-xs sm:text-sm md:text-base text-gray-600 font-light leading-relaxed transition-all duration-700"
              style={{
                opacity: communitySection.isInView ? 1 : 0,
                transform: communitySection.isInView ? 'translateY(0)' : 'translateY(20px)',
                transitionDelay: '200ms',
              }}
            >
              We support local makers, organic markets, children-focused spaces and environmental initiatives. 
              Everything we do is built around people&apos;s craft and care for nature.
            </p>
          </div>
        </div>
      </section>

      {/* Visit Us Section */}
      <section 
        ref={visitSection.ref as React.RefObject<HTMLElement>}
        className="bg-white pb-12 sm:pb-16 md:pb-20 lg:pb-24"
      >
        <div className="container px-4 sm:px-6">
          <div 
            className="max-w-sm sm:max-w-md md:max-w-xl mx-auto text-center md:text-left md:mx-0 transition-all duration-700"
            style={{
              opacity: visitSection.isInView ? 1 : 0,
              transform: visitSection.isInView ? 'translateY(0)' : 'translateY(30px)',
            }}
          >
            <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-semibold text-gray-900 mb-2 sm:mb-3">
              Visit Us <span className="text-sacred-burgundy animate-pulse">♀</span> Also
            </h2>
            <p 
              className="text-xs sm:text-sm md:text-base text-gray-600 font-light mb-5 sm:mb-6 transition-all duration-700"
              style={{
                opacity: visitSection.isInView ? 1 : 0,
                transform: visitSection.isInView ? 'translateY(0)' : 'translateY(20px)',
                transitionDelay: '150ms',
              }}
            >
              Come for a class, host an event or spend time in the space.
            </p>
            <div
              style={{
                opacity: visitSection.isInView ? 1 : 0,
                transform: visitSection.isInView ? 'translateY(0)' : 'translateY(20px)',
                transition: 'all 0.7s ease-out',
                transitionDelay: '300ms',
              }}
            >
              <MagneticButton
                className="w-full sm:w-auto px-5 sm:px-6 py-2.5 sm:py-3 bg-gray-800 hover:bg-gray-900 text-white text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 hover:shadow-xl hover:shadow-gray-800/30 flex items-center justify-center gap-2 group"
                onClick={() => window.location.href = '/contact'}
              >
                Contact Us
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </MagneticButton>
            </div>
          </div>
        </div>
        
        {/* Decorative Spinning Mandala */}
        <div className="mt-12 md:mt-16 flex justify-center">
          <div className="relative w-[200px] h-[200px] md:w-[300px] md:h-[300px]">
            <Image
              src="https://umxpjtfekclktbtomiaz.supabase.co/storage/v1/object/public/Assets/images/wheel.png"
              alt=""
              aria-hidden="true"
              fill
              sizes="(max-width: 768px) 200px, 300px"
              className="object-contain opacity-20 animate-spin-slow"
            />
          </div>
        </div>
      </section>

      {/* Booking Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Book {selectedClass?.title}</DialogTitle>
            <DialogDescription asChild>
              <div>
                {selectedClass ? (
                  <>
                    {formatDate(selectedClass.startsAt)} at {formatTime(selectedClass.startsAt)}
                    <br />
                    <span className="font-semibold text-primary">
                      {formatPrice(selectedClass.pricePaise)}
                    </span>
                  </>
                ) : (
                  <span>Loading class details...</span>
                )}
              </div>
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
                    <FormLabel>Phone Number</FormLabel>
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
                      Booking...
                    </>
                  ) : (
                    "Confirm Booking"
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
