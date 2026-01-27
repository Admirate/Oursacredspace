"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState, useCallback } from "react";

// Video URL from Supabase Storage
const HERO_VIDEO_URL = "https://umxpjtfekclktbtomiaz.supabase.co/storage/v1/object/public/Assets/videos/lotus.mp4";

// Video URLs
const WHO_WE_ARE_VIDEO = "https://umxpjtfekclktbtomiaz.supabase.co/storage/v1/object/public/Assets/videos/pottery.mp4";

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

// Magnetic Button Component
const MagneticButton = ({ children, className, href }: { children: React.ReactNode; className?: string; href: string }) => {
  const buttonRef = useRef<HTMLAnchorElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
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
    <Link
      ref={buttonRef}
      href={href}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        transition: position.x === 0 ? 'transform 0.3s ease-out' : 'none',
      }}
    >
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

// Ripple Button Component
const RippleButton = ({ children, className, href }: { children: React.ReactNode; className?: string; href: string }) => {
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
    <Link href={href} className={`${className} relative overflow-hidden`} onClick={handleClick}>
      {ripples.map(ripple => (
        <span
          key={ripple.id}
          className="absolute bg-white/30 rounded-full animate-ripple pointer-events-none"
          style={{
            left: ripple.x,
            top: ripple.y,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}
      {children}
    </Link>
  );
};

// Animated Counter Component
const AnimatedCounter = ({ end, duration = 2000, isVisible }: { end: number; duration?: number; isVisible: boolean }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isVisible) return;
    
    let startTime: number;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [end, duration, isVisible]);

  return <span>{count}</span>;
};

export default function HomePage() {
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const eventsSection = useInView(0.1);
  const whoWeAreSection = useInView(0.1);
  const offeringsSection = useInView(0.1);
  const communitySection = useInView(0.1);
  const visitSection = useInView(0.1);

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
                aria-label="Lotus pond video background"
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
                  <AnimatedText text="Our Sacred Space" isVisible={heroLoaded} className="block" />
                </h1>
                <p 
                  className={`mt-3 md:mt-4 text-sm md:text-base lg:text-lg text-white/90 max-w-md lg:max-w-lg font-light transition-all duration-1000 ease-out ${
                    heroLoaded ? "opacity-100 translate-y-0 delay-500" : "opacity-0 translate-y-8"
                  }`}
                  style={{ transitionDelay: '600ms' }}
                >
                  A safe space for art movement and mindful living.
                </p>
                
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Events & Quick Links Section */}
      <section 
        ref={eventsSection.ref as React.RefObject<HTMLElement>}
        className={`relative bg-white rounded-t-[24px] md:rounded-t-[40px] -mt-6 md:-mt-10 z-10 overflow-x-clip transition-all duration-1000 ease-out ${
          eventsSection.isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
        }`}
      >
        <div className="container px-4 flex justify-center">
          <div className="relative w-full max-w-[1414px]">
            <div className="bg-white px-6 md:px-12 lg:px-16 py-10 md:py-14 lg:py-16 relative overflow-visible">
              <img 
                src="https://umxpjtfekclktbtomiaz.supabase.co/storage/v1/object/public/Assets/images/wheel.png"
                alt=""
                className="absolute top-1/2 -translate-y-1/2 -right-16 md:-right-24 lg:-right-32 w-64 md:w-80 lg:w-96 h-64 md:h-80 lg:h-96 opacity-20 pointer-events-none animate-spin-slow object-contain"
                style={{
                  transform: `translateY(-50%) translate(${mousePosition.x * 0.3}px, ${mousePosition.y * 0.3}px)`,
                }}
                aria-hidden="true"
              />
              
              <div className="grid md:grid-cols-2 gap-8 md:gap-12 lg:gap-20 relative z-10">
                <div className="space-y-4 md:space-y-6">
                  <h2 
                    className={`text-xl md:text-2xl lg:text-3xl font-semibold text-gray-900 transition-all duration-700 ${
                      eventsSection.isInView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"
                    }`}
                    style={{ transitionDelay: '200ms' }}
                  >
                    <span className="relative inline-block group">
                      Upcoming Events
                      <span className="absolute -right-6 -top-1 text-sacred-pink-dark opacity-0 group-hover:opacity-100 transition-opacity">
                        <Sparkles className="w-4 h-4 animate-pulse" />
                      </span>
                    </span>
                  </h2>
                  <p 
                    className={`text-sm md:text-base text-gray-600 leading-relaxed max-w-md transition-all duration-700 ${
                      eventsSection.isInView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"
                    }`}
                    style={{ transitionDelay: '400ms' }}
                  >
                    Workshops performances markets and community gatherings that keep the space alive.
                  </p>
                  <div 
                    className={`pt-2 transition-all duration-700 ${
                      eventsSection.isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                    }`}
                    style={{ transitionDelay: '600ms' }}
                  >
                    <Button 
                      asChild 
                      className="group bg-[#c44536] hover:bg-[#a33a2d] text-white rounded-full px-6 md:px-8 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-[#c44536]/25 active:scale-95 relative overflow-hidden"
                    >
                      <RippleButton href="/events">
                        <span className="relative z-10 flex items-center gap-2">
                          View All Events
                          <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                        </span>
                      </RippleButton>
                    </Button>
                  </div>
                </div>
                
                <div className="flex flex-col justify-center space-y-4 md:space-y-6">
                  {/* Animated Link with underline effect */}
                  <Link 
                    href="/book-space"
                    className={`group flex items-center justify-between py-3 border-b border-gray-200 hover:border-sacred-green transition-all duration-500 hover:pl-2 ${
                      eventsSection.isInView ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
                    }`}
                    style={{ transitionDelay: '300ms' }}
                  >
                    <span className="relative text-base md:text-lg font-medium text-gray-900 group-hover:text-sacred-green transition-colors duration-300">
                      Book Your Space
                      <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-sacred-green transition-all duration-300 group-hover:w-full" />
                    </span>
                    <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-sacred-green transition-all duration-300 group-hover:translate-x-2 group-hover:scale-110" />
                  </Link>
                  
                  <Link 
                    href="/classes"
                    className={`group flex items-center justify-between py-3 border-b border-gray-200 hover:border-sacred-green transition-all duration-500 hover:pl-2 ${
                      eventsSection.isInView ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
                    }`}
                    style={{ transitionDelay: '450ms' }}
                  >
                    <span className="relative text-base md:text-lg font-medium text-gray-900 group-hover:text-sacred-green transition-colors duration-300">
                      Classes
                      <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-sacred-green transition-all duration-300 group-hover:w-full" />
                    </span>
                    <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-sacred-green transition-all duration-300 group-hover:translate-x-2 group-hover:scale-110" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Who We Are Section */}
      <section 
        ref={whoWeAreSection.ref as React.RefObject<HTMLElement>}
        className={`relative bg-white transition-all duration-1000 ease-out ${
          whoWeAreSection.isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
        }`}
      >
        <div className="container px-4 flex justify-center">
          <div className="relative w-full max-w-[1414px]">
            <div className="relative px-4 sm:px-6 md:px-12 lg:px-16 py-8 md:py-16 lg:py-20">
              <div className="relative z-10 w-full max-w-full sm:max-w-[90%] md:max-w-[762px]">
                <div className="relative overflow-hidden rounded-t-[16px] sm:rounded-t-[24px] md:rounded-t-[40px] shadow-xl aspect-[4/3] sm:aspect-[762/455] group cursor-pointer transition-shadow duration-500 hover:shadow-2xl hover:shadow-black/20">
                  <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                    aria-label="Hands working with clay - the art of creation"
                  >
                    <source src={WHO_WE_ARE_VIDEO} type="video/mp4" />
                  </video>
                  
                  {/* Animated border glow on hover */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                    <div className="absolute inset-0 rounded-t-[16px] sm:rounded-t-[24px] md:rounded-t-[40px] border-2 border-white/30 animate-border-glow" />
                  </div>
                  
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/20 transition-all duration-500 group-hover:from-black/80" />
                  
                  <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-5 md:p-6 lg:p-8">
                    <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-white mb-2 sm:mb-3 transition-all duration-500 group-hover:-translate-y-2 group-hover:text-shadow-glow">
                      Who We Are
                    </h2>
                    <div className="space-y-1.5 sm:space-y-2 text-white/90 text-[10px] sm:text-xs md:text-sm leading-relaxed max-h-0 overflow-hidden opacity-0 group-hover:max-h-48 group-hover:opacity-100 transition-all duration-500 ease-out">
                      <p className="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500 delay-100">
                        We are a cultural and community centre based in Secunderabad. 
                        Founded in 2012, we bring together art, wellness, learning, and 
                        environmental awareness in one shared space.
                      </p>
                      <p className="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500 delay-200">
                        We host dance, music, workshops, conversations, markets, and 
                        gatherings that encourage creative expression and conscious living.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Our Offerings Section */}
      <section 
        ref={offeringsSection.ref as React.RefObject<HTMLElement>}
        className={`relative bg-sacred-pink-dark rounded-t-[24px] md:rounded-t-[40px] -mt-6 md:-mt-10 z-10 transition-all duration-1000 ease-out ${
          offeringsSection.isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
        }`}
      >
        <div className="container px-4 flex justify-center">
          <div className="relative w-full max-w-[1414px]">
            <div className="px-6 md:px-12 lg:px-16 py-10 md:py-14 lg:py-16">
              <div className="space-y-0">
                {/* Regular Classes - Staggered animation */}
                <div 
                  className={`py-6 md:py-8 group rounded-xl px-4 -mx-4 transition-all duration-500 hover:bg-white/5 cursor-pointer ${
                    offeringsSection.isInView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-12"
                  }`}
                  style={{ transitionDelay: '100ms' }}
                >
                  <h3 className="text-lg md:text-xl font-semibold text-white mb-2 transition-transform duration-300 group-hover:translate-x-2">
                    Regular Classes
                  </h3>
                  <p className="text-sm md:text-base text-white/80 leading-relaxed max-w-2xl mb-4 transition-all duration-300 group-hover:text-white/90">
                    We offer ongoing classes across classical dance martial arts yoga languages and movement. 
                    Our classes are structured inclusive and led by experienced practitioners for all age groups.
                  </p>
                  <MagneticButton 
                    href="/classes"
                    className="inline-flex items-center gap-3 text-base md:text-lg font-medium text-white hover:text-white/80 transition-colors"
                  >
                    <span className="relative">
                      Explore Classes
                      <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-white transition-all duration-300 group-hover:w-full" />
                    </span>
                    <ArrowRight className="h-5 w-5 transition-all duration-300 group-hover:translate-x-2 group-hover:scale-110" />
                  </MagneticButton>
                </div>

                <div className="border-t border-white/20 transition-all duration-300 group-hover:border-white/30" />

                {/* Workshops - Staggered animation */}
                <div 
                  className={`py-6 md:py-8 group rounded-xl px-4 -mx-4 transition-all duration-500 hover:bg-white/5 cursor-pointer ${
                    offeringsSection.isInView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-12"
                  }`}
                  style={{ transitionDelay: '250ms' }}
                >
                  <h3 className="text-lg md:text-xl font-semibold text-white mb-2 transition-transform duration-300 group-hover:translate-x-2">
                    Workshops
                  </h3>
                  <p className="text-sm md:text-base text-white/80 leading-relaxed max-w-2xl mb-4 transition-all duration-300 group-hover:text-white/90">
                    We curate hands on workshops focused on learning through doing and shared experience. 
                    These sessions span art craft movement music and cultural practices.
                  </p>
                  <MagneticButton 
                    href="/events"
                    className="inline-flex items-center gap-3 text-base md:text-lg font-medium text-white hover:text-white/80 transition-colors"
                  >
                    <span className="relative">
                      View Workshops
                      <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-white transition-all duration-300 group-hover:w-full" />
                    </span>
                    <ArrowRight className="h-5 w-5 transition-all duration-300 group-hover:translate-x-2 group-hover:scale-110" />
                  </MagneticButton>
                </div>

                <div className="border-t border-white/20 transition-all duration-300 group-hover:border-white/30" />

                {/* Space Rentals - Staggered animation */}
                <div 
                  className={`py-6 md:py-8 group rounded-xl px-4 -mx-4 transition-all duration-500 hover:bg-white/5 cursor-pointer ${
                    offeringsSection.isInView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-12"
                  }`}
                  style={{ transitionDelay: '400ms' }}
                >
                  <h3 className="text-lg md:text-xl font-semibold text-white mb-2 transition-transform duration-300 group-hover:translate-x-2">
                    Space Rentals
                  </h3>
                  <p className="text-sm md:text-base text-white/80 leading-relaxed max-w-2xl mb-4 transition-all duration-300 group-hover:text-white/90">
                    We offer indoor and open air spaces for performances rehearsals meetings celebrations and community events. 
                    Our spaces are flexible calm and rooted in a cultural environment.
                  </p>
                  <MagneticButton 
                    href="/book-space"
                    className="inline-flex items-center gap-3 text-base md:text-lg font-medium text-white hover:text-white/80 transition-colors"
                  >
                    <span className="relative">
                      Book a Space
                      <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-white transition-all duration-300 group-hover:w-full" />
                    </span>
                    <ArrowRight className="h-5 w-5 transition-all duration-300 group-hover:translate-x-2 group-hover:scale-110" />
                  </MagneticButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Community and Culture Section */}
      <section 
        ref={communitySection.ref as React.RefObject<HTMLElement>}
        className={`py-12 md:py-16 lg:py-20 bg-white transition-all duration-1000 ease-out ${
          communitySection.isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
        }`}
      >
        <div className="container px-4 flex justify-center">
          <div className="relative w-full max-w-[1414px] px-6 md:px-12 lg:px-16">
            <div className="max-w-2xl">
              <h2 
                className={`text-2xl md:text-3xl lg:text-4xl font-semibold text-gray-900 mb-4 md:mb-6 transition-all duration-700 ${
                  communitySection.isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}
              >
                <span className="relative inline-block">
                  Community and Culture
                  <span className="absolute -bottom-2 left-0 w-12 h-1 bg-sacred-green rounded-full transition-all duration-700 delay-500" 
                    style={{ width: communitySection.isInView ? '3rem' : '0' }} 
                  />
                </span>
              </h2>
              <p 
                className={`text-sm md:text-base text-gray-600 leading-relaxed transition-all duration-700 ${
                  communitySection.isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}
                style={{ transitionDelay: '200ms' }}
              >
                We support local makers, organic markets, children-focused spaces, and environmental initiatives. 
                Everything we do is built around people, craft, and care for nature.
              </p>
              
              {/* Animated Stats */}
              <div 
                className={`flex gap-8 md:gap-12 mt-8 transition-all duration-700 ${
                  communitySection.isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}
                style={{ transitionDelay: '400ms' }}
              >
                <div className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-sacred-green">
                    <AnimatedCounter end={12} isVisible={communitySection.isInView} />+
                  </div>
                  <div className="text-xs md:text-sm text-gray-500 mt-1">Years Active</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-sacred-burgundy">
                    <AnimatedCounter end={50} isVisible={communitySection.isInView} />+
                  </div>
                  <div className="text-xs md:text-sm text-gray-500 mt-1">Classes</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-sacred-pink-dark">
                    <AnimatedCounter end={1000} duration={2500} isVisible={communitySection.isInView} />+
                  </div>
                  <div className="text-xs md:text-sm text-gray-500 mt-1">Community</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Visit Us Section */}
      <section 
        ref={visitSection.ref as React.RefObject<HTMLElement>}
        className={`py-12 md:py-16 lg:py-20 bg-white border-t border-gray-100 transition-all duration-1000 ease-out ${
          visitSection.isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
        }`}
      >
        <div className="container px-4 flex justify-center">
          <div className="relative w-full max-w-[1414px] px-6 md:px-12 lg:px-16">
            <div className="max-w-2xl">
              <h2 
                className={`text-2xl md:text-3xl lg:text-4xl font-semibold text-gray-900 mb-4 md:mb-6 flex items-center gap-2 transition-all duration-700 ${
                  visitSection.isInView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"
                }`}
              >
                Visit Us
                <span className="text-sacred-pink-dark animate-heartbeat inline-block">♡</span>
                Also
              </h2>
              <p 
                className={`text-sm md:text-base text-gray-600 leading-relaxed mb-6 md:mb-8 transition-all duration-700 ${
                  visitSection.isInView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"
                }`}
                style={{ transitionDelay: '200ms' }}
              >
                Come for a class, host an event, or spend time in the space.
              </p>
              <div
                className={`transition-all duration-700 ${
                  visitSection.isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}
                style={{ transitionDelay: '400ms' }}
              >
                <Button 
                  asChild 
                  className="group bg-[#c44536] hover:bg-[#a33a2d] text-white rounded-full px-6 md:px-8 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-[#c44536]/25 active:scale-95 relative overflow-hidden"
                >
                  <RippleButton href="/contact">
                    <span className="relative z-10 flex items-center gap-2">
                      Contact Us
                      <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </span>
                  </RippleButton>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
