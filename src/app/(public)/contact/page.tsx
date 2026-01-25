"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

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
  subject: z.string().min(3, "Subject must be at least 3 characters"),
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
      subject: "",
      message: "",
    },
  });

  const handleSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    
    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    toast({
      title: "Message Sent!",
      description: "We'll get back to you within 24 hours.",
    });
    
    form.reset();
    setIsSubmitting(false);
  };

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
                aria-label="Contact page video background"
              >
                <source src={HERO_VIDEO_URL} type="video/mp4" />
              </video>
              
              <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/30 to-transparent" />
              
              <div className="absolute inset-0 flex flex-col justify-center px-6 md:px-10 lg:px-16">
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-light text-white italic tracking-wide">
                  <AnimatedText text="Contact" isVisible={heroLoaded} className="block" />
                </h1>
                <p 
                  className={`mt-3 md:mt-4 text-sm md:text-base lg:text-lg text-white/90 max-w-md lg:max-w-lg font-light transition-all duration-1000 ease-out ${
                    heroLoaded ? "opacity-100 translate-y-0 delay-500" : "opacity-0 translate-y-8"
                  }`}
                  style={{ transitionDelay: '600ms' }}
                >
                  We are happy to help with classes, bookings, events or general enquiries.
                </p>
                
                {/* Animated scroll indicator */}
                <div 
                  className={`absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 transition-all duration-1000 ${
                    heroLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                  }`}
                  style={{ transitionDelay: '1000ms' }}
                >
                  <span className="text-white/60 text-xs tracking-widest uppercase">Scroll</span>
                  <div className="w-5 h-8 border-2 border-white/40 rounded-full flex justify-center">
                    <div className="w-1 h-2 bg-white/60 rounded-full mt-1 animate-bounce-slow" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Content Section */}
      <section 
        ref={contentSection.ref as React.RefObject<HTMLElement>}
        className="relative bg-white rounded-t-[24px] md:rounded-t-[40px] -mt-6 md:-mt-10 z-10"
      >
        {/* Decorative Rotating Mandala Background */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <div className="relative w-[500px] h-[500px] md:w-[600px] md:h-[600px] animate-spin-slow opacity-10">
            <Image
              src="https://umxpjtfekclktbtomiaz.supabase.co/storage/v1/object/public/Assets/images/wheel.png"
              alt=""
              fill
              className="object-contain"
              aria-hidden="true"
            />
          </div>
        </div>

        <div className="container relative py-12 md:py-16 lg:py-20">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 max-w-6xl mx-auto">
            
            {/* Contact Info */}
            <div 
              className="space-y-8"
              style={{
                opacity: contentSection.isInView ? 1 : 0,
                transform: contentSection.isInView ? 'translateX(0)' : 'translateX(-30px)',
                transition: 'all 0.7s ease-out',
              }}
            >
              <div>
                <h2 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-4">
                  Let&apos;s Connect
                </h2>
                <p className="text-gray-600 leading-relaxed">
                  Whether you want to book a class, rent our space for an event, or simply say hello, 
                  we&apos;re here for you. Drop us a message or visit us at our center.
                </p>
              </div>

              {/* Contact Cards */}
              <div className="grid sm:grid-cols-2 gap-4">
                {CONTACT_INFO.map((info, index) => (
                  <div
                    key={info.title}
                    className="group p-5 bg-sacred-cream/50 rounded-2xl hover:bg-sacred-cream transition-all duration-300 hover:shadow-lg hover:scale-[1.02]"
                    style={{
                      opacity: contentSection.isInView ? 1 : 0,
                      transform: contentSection.isInView ? 'translateY(0)' : 'translateY(20px)',
                      transition: 'all 0.5s ease-out',
                      transitionDelay: `${index * 100}ms`,
                    }}
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-2.5 bg-white rounded-xl shadow-sm group-hover:shadow-md transition-shadow">
                        <info.icon className="h-5 w-5 text-sacred-burgundy" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 mb-1">{info.title}</h3>
                        {info.link ? (
                          <a 
                            href={info.link}
                            className="text-sm text-gray-600 hover:text-sacred-burgundy transition-colors"
                            target={info.link.startsWith('http') ? '_blank' : undefined}
                            rel={info.link.startsWith('http') ? 'noopener noreferrer' : undefined}
                          >
                            {info.content}
                          </a>
                        ) : (
                          <p className="text-sm text-gray-600">{info.content}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Social Links */}
              <div
                style={{
                  opacity: contentSection.isInView ? 1 : 0,
                  transform: contentSection.isInView ? 'translateY(0)' : 'translateY(20px)',
                  transition: 'all 0.5s ease-out',
                  transitionDelay: '400ms',
                }}
              >
                <h3 className="font-medium text-gray-900 mb-3">Follow Us</h3>
                <div className="flex gap-3">
                  {SOCIAL_LINKS.map((social) => (
                    <a
                      key={social.label}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 bg-gray-100 rounded-xl hover:bg-sacred-burgundy hover:text-white transition-all duration-300 hover:scale-110 hover:shadow-lg"
                      aria-label={social.label}
                    >
                      <social.icon className="h-5 w-5" />
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div 
              ref={formSection.ref as React.RefObject<HTMLDivElement>}
              className="bg-white p-6 md:p-8 rounded-3xl shadow-xl border border-gray-100"
              style={{
                opacity: formSection.isInView ? 1 : 0,
                transform: formSection.isInView ? 'translateX(0)' : 'translateX(30px)',
                transition: 'all 0.7s ease-out',
                transitionDelay: '200ms',
              }}
            >
              <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-6">
                Send us a Message
              </h2>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Your name" 
                              className="rounded-xl border-gray-200 focus:border-sacred-burgundy focus:ring-sacred-burgundy/20"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input 
                              type="email" 
                              placeholder="you@example.com" 
                              className="rounded-xl border-gray-200 focus:border-sacred-burgundy focus:ring-sacred-burgundy/20"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone (Optional)</FormLabel>
                          <FormControl>
                            <div className="flex">
                              <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-gray-200 bg-gray-50 text-gray-500 text-sm">
                                +91
                              </span>
                              <Input
                                className="rounded-l-none rounded-r-xl border-gray-200 focus:border-sacred-burgundy focus:ring-sacred-burgundy/20"
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

                    <FormField
                      control={form.control}
                      name="subject"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Subject</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="What's this about?" 
                              className="rounded-xl border-gray-200 focus:border-sacred-burgundy focus:ring-sacred-burgundy/20"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Message</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Tell us more about your inquiry..."
                            className="min-h-[120px] rounded-xl border-gray-200 focus:border-sacred-burgundy focus:ring-sacred-burgundy/20 resize-none"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <MagneticButton
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 bg-sacred-burgundy hover:bg-sacred-burgundy/90 text-white font-medium rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-sacred-burgundy/30 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        Send Message
                        <Send className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                      </>
                    )}
                  </MagneticButton>
                </form>
              </Form>
            </div>
          </div>
        </div>
      </section>

      {/* Map Section */}
      <section 
        ref={mapSection.ref as React.RefObject<HTMLElement>}
        className="bg-sacred-cream py-12 md:py-16"
      >
        <div className="container px-4">
          <div 
            className="max-w-6xl mx-auto"
            style={{
              opacity: mapSection.isInView ? 1 : 0,
              transform: mapSection.isInView ? 'translateY(0)' : 'translateY(30px)',
              transition: 'all 0.7s ease-out',
            }}
          >
            <h2 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-6 text-center">
              Find Us Here
            </h2>
            <div className="rounded-3xl overflow-hidden shadow-xl h-[300px] md:h-[400px] bg-gray-200">
              {/* OpenStreetMap embed - East Marredpally, Secunderabad */}
              <iframe
                src="https://www.openstreetmap.org/export/embed.html?bbox=78.4900%2C17.4350%2C78.5200%2C17.4600&layer=mapnik&marker=17.4480%2C78.5060"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                title="Sacred Space Location - East Marredpally, Secunderabad"
              />
            </div>
            {/* Link to full map */}
            <div className="mt-4 text-center">
              <a 
                href="https://www.google.com/maps/search/?api=1&query=9-1-84+Sardar+Patel+Rd+East+Marredpally+Secunderabad+500026"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sacred-burgundy hover:text-sacred-burgundy/80 font-medium transition-colors"
              >
                <MapPin className="h-4 w-4" />
                Open in Google Maps
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-white py-12 md:py-16">
        <div className="container px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-4">
              Ready to Experience Our Space?
            </h2>
            <p className="text-gray-600 mb-6">
              Book a class, rent our venue, or simply drop by to explore what we offer.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                className="bg-sacred-burgundy hover:bg-sacred-burgundy/90 text-white rounded-xl px-6 py-3 flex items-center justify-center gap-2 group"
                onClick={() => window.location.href = '/classes'}
              >
                Browse Classes
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Button>
              <Button
                variant="outline"
                className="border-gray-300 hover:border-sacred-burgundy hover:text-sacred-burgundy rounded-xl px-6 py-3 flex items-center justify-center gap-2 group"
                onClick={() => window.location.href = '/book-space'}
              >
                Book Our Space
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Decorative Spinning Mandala at Bottom */}
      <div className="bg-white pb-12 md:pb-16 flex justify-center">
        <div className="relative w-[150px] h-[150px] md:w-[200px] md:h-[200px]">
          <Image
            src="https://umxpjtfekclktbtomiaz.supabase.co/storage/v1/object/public/Assets/images/wheel.png"
            alt=""
            aria-hidden="true"
            fill
            className="object-contain opacity-15 animate-spin-slow"
          />
        </div>
      </div>
    </div>
  );
}
