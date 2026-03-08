"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

// Hero video URL - replace with actual co-working space video
const HERO_VIDEO_URL = "https://umxpjtfekclktbtomiaz.supabase.co/storage/v1/object/public/Assets/videos/room.mp4";

// Banner video URL
const BANNER_VIDEO_URL = "https://umxpjtfekclktbtomiaz.supabase.co/storage/v1/object/public/Assets/videos/coworking-banner.mp4";

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

export default function CoWorkingSpacePage() {
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
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
    <div>
      {/* Hero Section */}
      <section className="relative bg-[#FFE5EC] py-4 xs:py-6 sm:py-8 md:py-10">
        <div className="container px-3 xs:px-4 flex justify-center">
          <div className="relative w-full max-w-[1414px] p-3 xs:p-4 sm:p-5 md:p-[40px] bg-[#FFE5EC] rounded-[16px] xs:rounded-[20px] sm:rounded-[24px] md:rounded-[40px]">
            <div className="relative overflow-hidden shadow-xl sm:shadow-2xl w-full h-[220px] xs:h-[260px] sm:h-[320px] md:h-[418px] lg:h-[498px] xl:h-[550px] rounded-[16px] xs:rounded-[20px] sm:rounded-[24px] md:rounded-[40px] group">
              <img
                src="https://umxpjtfekclktbtomiaz.supabase.co/storage/v1/object/public/Assets/images/co-workingHero.png"
                alt="Co Working background"
                className="absolute inset-0 h-full w-full object-cover object-top scale-105 "
              />
              <div className="absolute inset-0 bg-gradient-to-b from-gray-500/60 to-black/60" />

              <div className="absolute inset-0 flex flex-col justify-center px-4 xs:px-5 sm:px-6 md:px-10 lg:px-16">
                <h1 className="text-xl xs:text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-[600] text-white  tracking-wide">
                  <AnimatedText
                    text="Co Working Space"
                    isVisible={heroLoaded}
                    className="block"
                  />
                </h1>
                <p
                  className={`mt-2 xs:mt-3 md:mt-4 text-xs xs:text-sm sm:text-base md:text-base lg:text-lg text-white/90 max-w-[280px] xs:max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg font-light transition-all duration-1000 ease-out leading-relaxed ${
                    heroLoaded
                      ? "opacity-100 translate-y-0 delay-500"
                      : "opacity-0 translate-y-8"
                  }`}
                  style={{ transitionDelay: "600ms" }}
                >
                  We offer a work environment that feels calm, focused and
                  unhurried. It is designed for people who want to work with
                  clarity while staying connected to a larger cultural space.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Information Section */}
      <section className="relative bg-[#E2F0CB] py-12 xs:py-16 sm:py-20 md:py-24 lg:py-32 overflow-hidden rounded-t-[24px] md:rounded-t-[40px] -mt-6 md:-mt-10 z-10">
        {/* Decorative Rotating Mandala - Right Side */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/4 pointer-events-none">
          <div className="relative w-[200px] h-[200px] xs:w-[250px] xs:h-[250px] sm:w-[300px] sm:h-[300px] md:w-[400px] md:h-[400px] lg:w-[500px] lg:h-[500px]">
            <img
              src="https://umxpjtfekclktbtomiaz.supabase.co/storage/v1/object/public/Assets/images/tree-1.png"
              alt="tree"
              className=" absolute right-6 top-60 lg:top-40 h-full w-[420px] xl:w-[520px] object-contain opacity-20 pointer-events-none overflow-hidden"
              aria-hidden="true"
            />
          </div>
        </div>

        <div className="container px-4 xs:px-6 sm:px-8 lg:px-12 max-w-7xl">
          <div className="space-y-6 sm:space-y-8 md:space-y-10">
            {/* The Space */}
            <div className="space-y-2 sm:space-y-3">
              <h2 className="text-lg xs:text-xl sm:text-2xl font-[600] text-black">
                The Space
              </h2>
              <p className="text-sm xs:text-base sm:text-lg text-black leading-relaxed">
                Set within greenery the work area blends indoor comfort with
                open air options. You can choose between air conditioned seating
                or outdoor spaces depending on how you work best.
              </p>
            </div>

            {/* How You Work */}
            <div className="space-y-2 sm:space-y-3">
              <h2 className="text-lg xs:text-xl sm:text-2xl font-[600] text-black">
                How You Work
              </h2>
              <p className="text-sm xs:text-base sm:text-lg text-black leading-relaxed">
                The space supports individuals freelancers and small teams. It
                encourages focus while allowing room for pause movement and
                interaction.
              </p>
            </div>

            {/* Facilities */}
            <div className="space-y-2 sm:space-y-3">
              <h2 className="text-lg xs:text-xl sm:text-2xl font-[600] text-black">
                Facilities
              </h2>
              <p className="text-sm xs:text-base sm:text-lg text-black leading-relaxed">
                Wi-Fi power backup and comfortable seating are available. A
                conference room can be used for meetings discussions and
                collaborative sessions.
              </p>
            </div>

            {/* More Than Work */}
            <div className="space-y-2 sm:space-y-3">
              <h2 className="text-lg xs:text-xl sm:text-2xl font-[600] text-black">
                More Than Work
              </h2>
              <p className="text-sm xs:text-base sm:text-lg text-black leading-relaxed">
                Being here also means access to workshops cultural activities
                and events across the campus. Work and life flow together
                naturally.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Banner Section with Enquire Link */}
      <section className="relative h-[120px] xs:h-[140px] sm:h-[160px] md:h-[180px] lg:h-[200px] overflow-hidden">
        {/* Image instead of video */}
        <img
          src="https://umxpjtfekclktbtomiaz.supabase.co/storage/v1/object/public/Assets/images/co-workingImg-1.png"
          alt="Co-working space banner"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />

        {/* dark overlay */}
        <div className="absolute inset-0 bg-black/40" />

        {/* button */}
        <div className="absolute inset-0 flex items-center px-4 xs:px-6 sm:px-8 md:px-12 lg:px-16">
          <MagneticLink
            href="/contact"
            className="flex items-center gap-2 text-white text-sm xs:text-base sm:text-lg md:text-xl font-medium hover:text-white/80 transition-colors"
          >
            Enquire
            <ArrowRight className="h-4 w-4 xs:h-5 xs:w-5 md:h-6 md:w-6 transition-transform duration-300 group-hover:translate-x-2" />
          </MagneticLink>
        </div>
      </section>

      {/* Community and Culture Section */}
      <section
        ref={communitySection.ref as React.RefObject<HTMLElement>}
        className="bg-white py-8 xs:py-10 sm:py-12 md:py-16 lg:py-20 rounded-t-[24px] md:rounded-t-[40px] -mt-6 md:-mt-10 relative z-10"
      >
        <div className="container px-4 xs:px-5 sm:px-6">
          <div
            className="max-w-[280px] xs:max-w-sm sm:max-w-md md:max-w-xl lg:max-w-2xl mx-auto text-center md:text-left md:mx-0 transition-all duration-700"
            style={{
              opacity: communitySection.isInView ? 1 : 0,
              transform: communitySection.isInView
                ? "translateY(0)"
                : "translateY(30px)",
            }}
          >
            <h2 className="text-base xs:text-lg sm:text-xl md:text-2xl lg:text-3xl font-semibold text-gray-900 mb-2 xs:mb-3 sm:mb-4">
              Community and Culture
            </h2>
            <p
              className="text-[11px] xs:text-xs sm:text-sm md:text-base text-gray-600 font-light leading-relaxed transition-all duration-700"
              style={{
                opacity: communitySection.isInView ? 1 : 0,
                transform: communitySection.isInView
                  ? "translateY(0)"
                  : "translateY(20px)",
                transitionDelay: "200ms",
              }}
            >
              We support local makers, organic markets, children-focused spaces
              and environmental initiatives. Everything we do is built around
              people&apos;s craft and care for nature.
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
              transform: visitSection.isInView
                ? "translateY(0)"
                : "translateY(30px)",
            }}
          >
            <h2 className="text-base xs:text-lg sm:text-xl md:text-2xl lg:text-3xl font-semibold text-gray-900 mb-1.5 xs:mb-2 sm:mb-3">
              Visit Us{" "}
              <span className="inline-block mb-2 mx-1">
                <img
                  src="https://umxpjtfekclktbtomiaz.supabase.co/storage/v1/object/public/Assets/images/visit.png"
                  alt="visit"
                  className="lg:w-5 lg:h-8 md:w-4 md:h-7 w-3 h-5 mb-1 inline-block"
                />
              </span>{" "}
              Also
            </h2>
            <p
              className="text-[11px] xs:text-xs sm:text-sm md:text-base text-gray-600 font-light mb-4 xs:mb-5 sm:mb-6 transition-all duration-700"
              style={{
                opacity: visitSection.isInView ? 1 : 0,
                transform: visitSection.isInView
                  ? "translateY(0)"
                  : "translateY(20px)",
                transitionDelay: "150ms",
              }}
            >
              Come for a class, host an event or spend time in the space.
            </p>
            <div
              style={{
                opacity: visitSection.isInView ? 1 : 0,
                transform: visitSection.isInView
                  ? "translateY(0)"
                  : "translateY(20px)",
                transition: "all 0.7s ease-out",
                transitionDelay: "300ms",
              }}
            >
              <MagneticButton
                className="w-full xs:w-auto px-4 xs:px-5 sm:px-6 py-2 xs:py-2.5 sm:py-3 bg-[#C23536] hover:bg-[#a33a2d] text-white text-[11px] xs:text-xs sm:text-sm font-medium rounded-3xl transition-all duration-200 hover:shadow-xl hover:shadow-sacred-burgundy/30 flex items-center justify-center gap-2 group"
                onClick={() => (window.location.href = "/contact")}
              >
                Contact Us
                 </MagneticButton>
            </div>
          </div>
        </div>
       </section>
    </div>
  );
}
