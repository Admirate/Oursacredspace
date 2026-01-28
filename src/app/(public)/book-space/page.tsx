"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

// Video URL from Supabase Storage
const HERO_VIDEO_URL = "https://umxpjtfekclktbtomiaz.supabase.co/storage/v1/object/public/Assets/videos/nature.mp4";

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

// 3D Tilt Card Component - tilts on hover based on mouse position
const TiltCard = ({ 
  children, 
  className,
  intensity = 10
}: { 
  children: React.ReactNode; 
  className?: string;
  intensity?: number;
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ rotateX: 0, rotateY: 0, scale: 1 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rotateX = ((y - centerY) / centerY) * -intensity;
    const rotateY = ((x - centerX) / centerX) * intensity;
    
    setTransform({ rotateX, rotateY, scale: 1.02 });
  }, [intensity]);

  const handleMouseLeave = useCallback(() => {
    setTransform({ rotateX: 0, rotateY: 0, scale: 1 });
    setIsHovered(false);
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  return (
    <div
      ref={cardRef}
      className={`${className} transition-shadow duration-300`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
      style={{
        transform: `perspective(1000px) rotateX(${transform.rotateX}deg) rotateY(${transform.rotateY}deg) scale(${transform.scale})`,
        transition: isHovered ? 'none' : 'transform 0.5s ease-out',
        transformStyle: 'preserve-3d',
      }}
    >
      {children}
    </div>
  );
};

// Video Card with Shimmer and Hover Effects
const VideoCard = ({ 
  src, 
  className,
  delay = 0,
  isVisible = true
}: { 
  src: string; 
  className?: string;
  delay?: number;
  isVisible?: boolean;
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div 
      className={`${className} relative overflow-hidden rounded-xl sm:rounded-2xl group cursor-pointer`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
        transition: 'all 0.7s ease-out',
        transitionDelay: `${delay}ms`,
      }}
    >
      {/* Shimmer effect while loading */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-shimmer" />
      )}
      
      <video
        autoPlay
        loop
        muted
        playsInline
        onLoadedData={() => setIsLoaded(true)}
        className={`absolute inset-0 h-full w-full object-cover transition-all duration-700 ${
          isHovered ? 'scale-110 brightness-110' : 'scale-100 brightness-100'
        }`}
      >
        <source src={src} type="video/mp4" />
      </video>
      
      {/* Hover overlay with gradient */}
      <div className={`absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent transition-opacity duration-300 ${
        isHovered ? 'opacity-100' : 'opacity-0'
      }`} />
      
      {/* Corner glow effect on hover - hidden on mobile for performance */}
      <div className={`absolute inset-0 transition-opacity duration-500 hidden sm:block ${
        isHovered ? 'opacity-100' : 'opacity-0'
      }`}>
        <div className="absolute top-0 left-0 w-16 h-16 sm:w-20 sm:h-20 bg-white/20 blur-2xl rounded-full -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-16 h-16 sm:w-20 sm:h-20 bg-white/20 blur-2xl rounded-full translate-x-1/2 translate-y-1/2" />
      </div>
    </div>
  );
};

// Info Card with hover effects
const InfoCard = ({ 
  title, 
  description,
  delay = 0,
  isVisible = true
}: { 
  title: string; 
  description: string;
  delay?: number;
  isVisible?: boolean;
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <TiltCard
      className={`bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 flex flex-col justify-center min-h-[160px] sm:min-h-[180px] md:min-h-[200px] ${
        isHovered ? 'shadow-xl shadow-black/10' : 'shadow-none'
      }`}
      intensity={5}
    >
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
          transition: 'all 0.7s ease-out',
          transitionDelay: `${delay}ms`,
        }}
      >
        <h3 className={`text-gray-900 text-base sm:text-lg md:text-xl font-semibold mb-2 sm:mb-3 transition-all duration-300 ${
          isHovered ? 'translate-x-1' : ''
        }`}>
          {title}
        </h3>
        <p className={`text-gray-600 text-xs sm:text-sm font-light leading-relaxed transition-all duration-300 ${
          isHovered ? 'text-gray-700' : ''
        }`}>
          {description}
        </p>
        
        {/* Subtle underline animation */}
        <div className={`h-0.5 bg-sacred-green/50 mt-3 sm:mt-4 transition-all duration-500 ease-out ${
          isHovered ? 'w-10 sm:w-12' : 'w-0'
        }`} />
      </div>
    </TiltCard>
  );
};

// Magnetic Link Component
const MagneticLink = ({ 
  href, 
  children, 
  className 
}: { 
  href: string; 
  children: React.ReactNode; 
  className?: string;
}) => {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    const link = linkRef.current;
    if (!link) return;
    
    const rect = link.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    
    setPosition({ x: x * 0.3, y: y * 0.3 });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setPosition({ x: 0, y: 0 });
    setIsHovered(false);
  }, []);

  return (
    <Link
      ref={linkRef}
      href={href}
      className={`${className} group relative`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={() => setIsHovered(true)}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        transition: position.x === 0 ? 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none',
      }}
    >
      {children}
      {/* Glow effect */}
      <div className={`absolute inset-0 bg-white/20 blur-xl rounded-full transition-opacity duration-300 ${
        isHovered ? 'opacity-100' : 'opacity-0'
      }`} />
    </Link>
  );
};

export default function SpacesPage() {
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const bentoSection = useInView(0.1);
  const communitySection = useInView(0.1);
  const visitSection = useInView(0.1);

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

  return (
    <div className="overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative bg-sacred-pink py-4 xs:py-6 sm:py-8 md:py-10">
        <div className="container px-3 xs:px-4 flex justify-center">
          <div className="relative w-full max-w-[1414px] p-3 xs:p-4 sm:p-5 md:p-[40px] bg-sacred-pink rounded-[16px] xs:rounded-[20px] sm:rounded-[24px] md:rounded-[40px]">
            <div className="relative overflow-hidden shadow-xl sm:shadow-2xl w-full h-[220px] xs:h-[260px] sm:h-[320px] md:h-[418px] lg:h-[498px] xl:h-[550px] rounded-[16px] xs:rounded-[20px] sm:rounded-[24px] md:rounded-[40px] group">
              <video
                autoPlay
                loop
                muted
                playsInline
                className="absolute inset-0 h-full w-full object-cover scale-105 transition-transform duration-2000 group-hover:scale-110"
                style={{
                  transform: `scale(1.05) translate(${mousePosition.x * 0.5}px, ${mousePosition.y * 0.5}px)`,
                }}
                aria-label="Space rentals video background"
              >
                <source src={HERO_VIDEO_URL} type="video/mp4" />
              </video>
              
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-transparent sm:from-black/50 sm:via-black/30" />
              
              {/* Floating particles - fewer on mobile */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className={`absolute w-1.5 sm:w-2 h-1.5 sm:h-2 bg-white/20 rounded-full animate-float ${i > 3 ? 'hidden sm:block' : ''}`}
                    style={{
                      left: `${15 + i * 15}%`,
                      top: `${20 + (i % 3) * 25}%`,
                      animationDelay: `${i * 0.5}s`,
                      animationDuration: `${3 + i * 0.5}s`,
                    }}
                  />
                ))}
              </div>
              
              <div className="absolute inset-0 flex flex-col justify-center px-4 xs:px-5 sm:px-6 md:px-10 lg:px-16">
                <h1 className="text-xl xs:text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-light text-white italic tracking-wide">
                  <AnimatedText text="Space Rentals" isVisible={heroLoaded} className="block" />
                </h1>
                <p 
                  className={`mt-2 xs:mt-3 md:mt-4 text-xs xs:text-sm sm:text-base md:text-base lg:text-lg text-white/90 max-w-[280px] xs:max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg font-light transition-all duration-1000 ease-out leading-relaxed ${
                    heroLoaded ? "opacity-100 translate-y-0 delay-500" : "opacity-0 translate-y-8"
                  }`}
                  style={{ transitionDelay: '600ms' }}
                >
                  We offer spaces that adapt to different needs and formats.
                  Quiet intimate or open and expressive depending on what you're hosting.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bento Grid Section */}
      <section 
        ref={bentoSection.ref as React.RefObject<HTMLElement>}
        className="bg-sacred-pink px-3 xs:px-4 sm:px-6 lg:px-8 pb-6 sm:pb-8 md:pb-12"
      >
        <div className="max-w-[1414px] mx-auto">
          {/* Bento Grid - 1 col mobile, 2 col tablet, 3 col desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 xs:gap-4 md:gap-5">
            {/* Video Card 1 */}
            <VideoCard 
              src="https://umxpjtfekclktbtomiaz.supabase.co/storage/v1/object/public/Assets/videos/roof2.mp4"
              className="h-[180px] xs:h-[200px] sm:h-[220px] md:h-[240px] lg:h-[260px]"
              delay={0}
              isVisible={bentoSection.isInView}
            />

            {/* What You Can Use */}
            <InfoCard
              title="What You Can Use"
              description="Indoor halls open courtyards studios and flexible rooms across the campus. Each space is designed to feel calm, functional, and welcoming."
              delay={100}
              isVisible={bentoSection.isInView}
            />

            {/* What It Works For */}
            <InfoCard
              title="What It Works For"
              description="Performances rehearsals talks workshops meetings celebrations and private gatherings. Both cultural and non-cultural use are welcome."
              delay={200}
              isVisible={bentoSection.isInView}
            />

            {/* How It Works */}
            <InfoCard
              title="How It Works"
              description="Spaces can be booked for short durations or full day use. Support is available based on the nature of the event."
              delay={300}
              isVisible={bentoSection.isInView}
            />

            {/* The Setting */}
            <InfoCard
              title="The Setting"
              description="The campus is surrounded by greenery and natural light. Events here feel grounded, unhurried and personal."
              delay={400}
              isVisible={bentoSection.isInView}
            />

            {/* Video Card 2 */}
            <VideoCard 
              src="https://umxpjtfekclktbtomiaz.supabase.co/storage/v1/object/public/Assets/videos/room.mp4"
              className="h-[180px] xs:h-[200px] sm:h-[220px] md:h-[240px] lg:h-[260px]"
              delay={500}
              isVisible={bentoSection.isInView}
            />
          </div>

          {/* CTA Links */}
          <div 
            className="flex flex-col xs:flex-row justify-between items-center gap-4 xs:gap-6 mt-6 sm:mt-8 md:mt-12 px-1 sm:px-2"
            style={{
              opacity: bentoSection.isInView ? 1 : 0,
              transform: bentoSection.isInView ? 'translateY(0)' : 'translateY(20px)',
              transition: 'all 0.7s ease-out',
              transitionDelay: '600ms',
            }}
          >
            <MagneticLink
              href="/space-enquiry"
              className="flex items-center gap-2 text-white text-xs xs:text-sm md:text-base font-medium hover:text-white/80 transition-colors"
            >
              Book a Space
              <ArrowRight className="h-3.5 w-3.5 xs:h-4 xs:w-4 md:h-5 md:w-5 transition-transform duration-300 group-hover:translate-x-2" />
            </MagneticLink>
            <MagneticLink
              href="/contact"
              className="flex items-center gap-2 text-white text-xs xs:text-sm md:text-base font-medium hover:text-white/80 transition-colors"
            >
              Enquire
              <ArrowRight className="h-3.5 w-3.5 xs:h-4 xs:w-4 md:h-5 md:w-5 transition-transform duration-300 group-hover:translate-x-2" />
            </MagneticLink>
          </div>
        </div>
      </section>

      {/* Community and Culture Section */}
      <section 
        ref={communitySection.ref as React.RefObject<HTMLElement>}
        className="bg-white py-8 xs:py-10 sm:py-12 md:py-16 lg:py-20"
      >
        <div className="container px-4 xs:px-5 sm:px-6">
          <div 
            className="max-w-[280px] xs:max-w-sm sm:max-w-md md:max-w-xl lg:max-w-2xl mx-auto text-center md:text-left md:mx-0 transition-all duration-700"
            style={{
              opacity: communitySection.isInView ? 1 : 0,
              transform: communitySection.isInView ? 'translateY(0)' : 'translateY(30px)',
            }}
          >
            <h2 className="text-base xs:text-lg sm:text-xl md:text-2xl lg:text-3xl font-semibold text-gray-900 mb-2 xs:mb-3 sm:mb-4">
              Community and Culture
            </h2>
            <p 
              className="text-[11px] xs:text-xs sm:text-sm md:text-base text-gray-600 font-light leading-relaxed transition-all duration-700"
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
        className="bg-white pb-10 xs:pb-12 sm:pb-16 md:pb-20 lg:pb-24"
      >
        <div className="container px-4 xs:px-5 sm:px-6">
          <div 
            className="max-w-[280px] xs:max-w-sm sm:max-w-md md:max-w-xl lg:max-w-2xl mx-auto text-center md:text-left md:mx-0 transition-all duration-700"
            style={{
              opacity: visitSection.isInView ? 1 : 0,
              transform: visitSection.isInView ? 'translateY(0)' : 'translateY(30px)',
            }}
          >
            <h2 className="text-base xs:text-lg sm:text-xl md:text-2xl lg:text-3xl font-semibold text-gray-900 mb-1.5 xs:mb-2 sm:mb-3">
              Visit Us <span className="text-sacred-burgundy animate-pulse">♀</span> Also
            </h2>
            <p 
              className="text-[11px] xs:text-xs sm:text-sm md:text-base text-gray-600 font-light mb-4 xs:mb-5 sm:mb-6 transition-all duration-700"
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
                className="w-full xs:w-auto px-4 xs:px-5 sm:px-6 py-2 xs:py-2.5 sm:py-3 bg-gray-800 hover:bg-gray-900 text-white text-[11px] xs:text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 hover:shadow-xl hover:shadow-gray-800/30 flex items-center justify-center gap-2 group"
                onClick={() => window.location.href = '/contact'}
              >
                Contact Us
                <ArrowRight className="h-3.5 w-3.5 xs:h-4 xs:w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </MagneticButton>
            </div>
          </div>
        </div>
        
        {/* Decorative Spinning Mandala */}
        <div className="mt-8 xs:mt-10 sm:mt-12 md:mt-16 flex justify-center">
          <div className="relative w-[150px] h-[150px] xs:w-[180px] xs:h-[180px] sm:w-[200px] sm:h-[200px] md:w-[280px] md:h-[280px] lg:w-[300px] lg:h-[300px]">
            <Image
              src="https://umxpjtfekclktbtomiaz.supabase.co/storage/v1/object/public/Assets/images/wheel.png"
              alt=""
              aria-hidden="true"
              fill
              sizes="(max-width: 480px) 150px, (max-width: 640px) 180px, (max-width: 768px) 200px, (max-width: 1024px) 280px, 300px"
              className="object-contain opacity-20 animate-spin-slow"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
