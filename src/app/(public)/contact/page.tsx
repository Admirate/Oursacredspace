"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import Image from "next/image";
import { 
  MapPin, 
  Phone, 
  Mail, 
  Clock, 
  Send, 
  Loader2,
  Instagram,
  Facebook,
  ArrowRight,
  CheckCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

// Video URL from Supabase Storage
const HERO_VIDEO_URL = "https://umxpjtfekclktbtomiaz.supabase.co/storage/v1/object/public/Assets/videos/plant.mp4";

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
// Ripple Button Component
const RippleButton = ({ 
  children, 
  className, 
  href 
}: { 
  children: React.ReactNode; 
  className?: string; 
  href: string;
}) => {
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([]);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();
    
    setRipples(prev => [...prev, { x, y, id }]);
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== id));
    }, 600);
  };

  return (
    <Link 
      href={href} 
      className={`${className} relative overflow-hidden`} 
      onClick={handleClick}
    >
      {ripples.map(ripple => (
        <span
          key={ripple.id}
          className="absolute bg-white/30 rounded-full pointer-events-none"
          style={{
            left: ripple.x,
            top: ripple.y,
            transform: 'translate(-50%, -50%)',
            width: '200px',
            height: '200px',
            animation: 'ripple 0.6s ease-out forwards',
          }}
        />
      ))}
      {children}
    </Link>
  );
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

// Magnetic Button Component
const MagneticButton = ({ 
  children, 
  className, 
  type = "button",
  disabled = false,
  onClick 
}: { 
  children: React.ReactNode; 
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
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
      type={type}
      disabled={disabled}
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

// Contact form schema
const contactFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email"),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit Indian mobile number").optional().or(z.literal("")),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

type ContactFormData = z.infer<typeof contactFormSchema>;

// Contact info data
const CONTACT_INFO = [
  {
    icon: MapPin,
    title: "Visit Us",
    content: "9-1-84, Sardar Patel Rd, East Marredpally, Secunderabad, Telangana 500026",
    link: "https://maps.google.com/maps?q=9-1-84+Sardar+Patel+Rd+East+Marredpally+Secunderabad+500026",
  },
  {
    icon: Phone,
    title: "Call Us",
    content: "+91 98765 43210",
    link: "tel:+919876543210",
  },
  {
    icon: Mail,
    title: "Email Us",
    content: "hello@oursacredspace.in",
    link: "mailto:hello@oursacredspace.in",
  },
  {
    icon: Clock,
    title: "Working Hours",
    content: "Mon - Sat: 9:00 AM - 8:00 PM",
    link: null,
  },
];

const SOCIAL_LINKS = [
  { icon: Instagram, href: "https://instagram.com", label: "Instagram" },
  { icon: Facebook, href: "https://facebook.com", label: "Facebook" },
];

export default function ContactPage() {
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const { toast } = useToast();
  
  const contentSection = useInView(0.1);
  const formSection = useInView(0.1);
  const mapSection = useInView(0.1);

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

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      message: "",
    },
  });

  const handleSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    try {
      // 1. Store in database via API
      await api.createEnquiry({
        name: data.name,
        email: data.email,
        phone: data.phone || undefined,
        message: data.message,
      });

      // 2. Submit to Netlify Forms for email notification
      try {
        const formData = new URLSearchParams();
        formData.append("form-name", "contact");
        formData.append("name", data.name);
        formData.append("email", data.email);
        formData.append("phone", data.phone || "");
        formData.append("message", data.message);
        await fetch("/", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formData.toString(),
        });
      } catch {
        // Netlify Forms failure is non-critical — DB already has the enquiry
      }

      form.reset();
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
    } catch (error) {
      toast({
        title: "Something went wrong",
        description: error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="overflow-x-visible">
      {/* Hidden Netlify Form for build-time detection */}
      <form name="contact" data-netlify="true" hidden>
        <input type="hidden" name="form-name" value="contact" />
        <input name="name" />
        <input name="email" />
        <input name="phone" />
        <textarea name="message" />
      </form>

      {/* Hero Section */}
      <section className="relative bg-[#FFE5EC] py-8 md:py-10 lg:py-16">
        <div className="container px-4 flex justify-center">
          <div className="relative w-full max-w-[1414px] p-5 md:p-[40px] bg-[#FFE5EC] rounded-[24px] md:rounded-[40px]">
            <div className="relative overflow-hidden shadow-2xl w-full h-[280px] sm:h-[350px] md:h-[418px] lg:h-[498px] rounded-[24px] md:rounded-[40px] group">
              <img
                src="https://umxpjtfekclktbtomiaz.supabase.co/storage/v1/object/public/Assets/images/contactHero.png"
                alt="Classes background"
                className="absolute inset-0 h-full w-full object-cover object-top scale-105 "
              />
              <div className="absolute inset-0 bg-gradient-to-b from-gray-500/60 to-black/60" />

              <div className="absolute inset-0 flex flex-col justify-center px-6 md:px-10 lg:px-16">
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-[600] text-white tracking-wide whitespace-nowrap">
                  <AnimatedText
                    text="Contact"
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
                  We are happy to help with classes, bookings, events or general
                  enquiries.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Info + Form Section */}
      <section className=" relative bg-[#E2F0CB] -mt-8 md:-mt-10 z-10 rounded-t-[32px] md:rounded-t-[48px] overflow-hidden">
        {/* rounded main box */}
        <div className="w-full relative z-10 overflow-hidden">
          {/* main rounded box */}
          <div className="container px-4 flex justify-center">
          <div className="w-full max-w-[1414px] px-6 md:px-12 lg:px-16 py-16 md:py-24">
            {/* top info */}
            <div className="space-y-6 md:space-y-8 max-w-xl">
              <div>
                <h3 className="text-black font-semibold text-lg">Call</h3>
                <p className="text-sm mt-1">
                  +91 9030613344 &nbsp;&nbsp; / &nbsp; +91 6309822344
                </p>
              </div>

              <div>
                <h3 className="text-black font-semibold text-lg">Write</h3>
                <p className="text-sm mt-1 text-black/80">
                  Use the enquiry form for detailed questions or requests.
                </p>
              </div>

              <div>
                <h3 className="text-black font-semibold text-lg">Visit</h3>
                <p className="text-sm mt-1 text-black/80">
                  You can also speak to us when you are at the space.
                </p>
              </div>
            </div>

            {/* address grid */}
            <div className="grid md:grid-cols-3 gap-8 md:gap-12 mt-10 md:mt-14 text-sm text-black/90">
              {/* address 1 */}
              <div>
                <h4 className="font-semibold mb-2">Our Sacred Space</h4>
                <p className="leading-relaxed">
                  Shop Marredpally, Before Himalaya Book World,
                  <br />
                  9-1-84, Sardar Patel Rd, beside Orchids Flower,
                  <br />
                  Regimental Bazaar, East Marredpally,
                  <br />
                  Secunderabad, Telangana 500026
                </p>
                <p className="mt-3">Open 9 AM - 7 PM</p>
              </div>

              {/* address 2 */}
              <div>
                <h4 className="font-semibold mb-2">Chaurah Auditorium</h4>
                <p className="leading-relaxed">
                  Sarojini Devi Rd, before Sangeet Cross Roads,
                  <br />
                  Regimental Bazaar, Shivaji Nagar,
                  <br />
                  Secunderabad, Telangana 500003
                </p>
                <p className="mt-3">Open 6:30 AM - 7 PM</p>
              </div>

              {/* address 3 */}
              <div>
                <h4 className="font-semibold mb-2">Hamsaveni Co-Working</h4>
                <p className="leading-relaxed">
                  I-84, 9, W Marredpally Rd, Regimental Bazaar,
                  <br />
                  East Marredpally, Secunderabad, Telangana 500003
                </p>
                <p className="mt-3">Open 9 AM - 7 PM</p>
              </div>
            </div>
          </div>
          </div>
        </div>
      </section>

      <section className="relative bg-[#FFE5EC] -mt-8 md:-mt-10 z-10 rounded-t-[32px] md:rounded-t-[48px] overflow-hidden">
        {/* Form */}
        <div className="bg-[#FFE5EC] py-12 md:py-16">
          <div className="max-w-[1414px] mx-auto px-6 md:px-12 lg:px-16">
            {/* title */}
            <h2 className="text-center text-lg md:text-xl font-medium mb-10">
              Send an Enquiry
            </h2>

            {/* Success confirmation */}
            {showSuccess && (
              <div className="mb-10 flex justify-center">
                <div className="bg-[#2d5a27]/10 border border-[#2d5a27]/30 rounded-2xl px-8 py-6 max-w-lg w-full flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#2d5a27] flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#2d5a27] text-sm">Enquiry Sent Successfully!</p>
                    <p className="text-xs text-black/60 mt-0.5">We&apos;ll get back to you within 24 hours.</p>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={form.handleSubmit(handleSubmit)}>
              <div className="grid md:grid-cols-[320px_1fr] gap-10 md:gap-12 items-start">
                {/* LEFT INPUTS */}
                <div className="space-y-5 flex flex-col items-center md:items-start">
                  <div className="w-full md:w-[240px]">
                    <input
                      {...form.register("name")}
                      placeholder="Enter Name"
                      className={`w-full rounded-full border bg-transparent px-5 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-[#2d5a27]/30 focus:border-[#2d5a27] ${
                        form.formState.errors.name
                          ? "border-red-500 focus:ring-red-200"
                          : "border-black/40 hover:border-black/70"
                      }`}
                    />
                    {form.formState.errors.name && (
                      <p className="text-red-600 text-xs mt-1.5 px-3">{form.formState.errors.name.message}</p>
                    )}
                  </div>

                  <div className="w-full md:w-[240px]">
                    <input
                      {...form.register("email")}
                      placeholder="Email"
                      type="email"
                      className={`w-full rounded-full border bg-transparent px-5 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-[#2d5a27]/30 focus:border-[#2d5a27] ${
                        form.formState.errors.email
                          ? "border-red-500 focus:ring-red-200"
                          : "border-black/40 hover:border-black/70"
                      }`}
                    />
                    {form.formState.errors.email && (
                      <p className="text-red-600 text-xs mt-1.5 px-3">{form.formState.errors.email.message}</p>
                    )}
                  </div>

                  <div className="w-full md:w-[240px]">
                    <input
                      {...form.register("phone")}
                      placeholder="Phone Number"
                      type="tel"
                      maxLength={10}
                      className={`w-full rounded-full border bg-transparent px-5 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-[#2d5a27]/30 focus:border-[#2d5a27] ${
                        form.formState.errors.phone
                          ? "border-red-500 focus:ring-red-200"
                          : "border-black/40 hover:border-black/70"
                      }`}
                    />
                    {form.formState.errors.phone && (
                      <p className="text-red-600 text-xs mt-1.5 px-3">{form.formState.errors.phone.message}</p>
                    )}
                    {!form.formState.errors.phone && (
                      <p className="text-black/40 text-[10px] mt-1 px-3">Optional</p>
                    )}
                  </div>
                </div>

                {/* RIGHT MESSAGE */}
                <div className="flex flex-col">
                  <textarea
                    {...form.register("message")}
                    placeholder="Message"
                    rows={7}
                    className={`w-full rounded-[28px] border bg-transparent px-6 py-5 text-sm outline-none resize-none transition-colors focus:ring-2 focus:ring-[#2d5a27]/30 focus:border-[#2d5a27] ${
                      form.formState.errors.message
                        ? "border-red-500 focus:ring-red-200"
                        : "border-black/40 hover:border-black/70"
                    }`}
                  />
                  {form.formState.errors.message && (
                    <p className="text-red-600 text-xs mt-1.5 px-3">{form.formState.errors.message.message}</p>
                  )}
                </div>
              </div>

              <div className="flex justify-center mt-10">
                <MagneticButton
                  type="submit"
                  disabled={isSubmitting}
                  className="px-10 py-3 rounded-full bg-black text-white text-sm font-medium hover:bg-black/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
                  ) : (
                    <><Send className="w-4 h-4" /> Send Enquiry</>
                  )}
                </MagneticButton>
              </div>
            </form>
          </div>
        </div>
      </section>
      
    </div>
  );
}
