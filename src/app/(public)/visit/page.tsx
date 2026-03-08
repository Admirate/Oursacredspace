"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

// Video URL from Supabase Storage - update with your visit video
const HERO_VIDEO_URL = "https://umxpjtfekclktbtomiaz.supabase.co/storage/v1/object/public/Assets/videos/danceclass.mp4";

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
const AnimatedText = ({ 
  text, 
  className, 
  delay = 0, 
  isVisible 
}: { 
  text: string; 
  className?: string; 
  delay?: number; 
  isVisible: boolean;
}) => {
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

export default function VisitPage() {
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  
  const infoSection = useInView(0.1);
  const communitySection = useInView(0.1);
  const contactSection = useInView(0.1);

  useEffect(() => {
    const timer = setTimeout(() => setHeroLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

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
      <section className="relative bg-[#FFE5EC] py-8 md:py-10">
        <div className="container px-4 flex justify-center">
          <div className="relative w-full max-w-[1414px] p-5 md:p-[40px] bg-[#FFE5EC] rounded-[24px] md:rounded-[40px]">
            <div className="relative overflow-hidden shadow-2xl w-full h-[280px] sm:h-[350px] md:h-[418px] lg:h-[498px] rounded-[24px] md:rounded-[40px] group">
              <img
                src="https://umxpjtfekclktbtomiaz.supabase.co/storage/v1/object/public/Assets/images/visitHero.jpg"
                alt="Classes background"
                className="absolute inset-0 h-full w-full object-cover scale-105 "
              />
              <div className="absolute inset-0 bg-gradient-to-b from-gray-500/60 to-black/60" />

              {/* Floating particles
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
              </div> */}

              <div className="absolute inset-0 flex flex-col justify-center px-6 md:px-10 lg:px-16">
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-[600] text-white tracking-wide whitespace-nowrap">
                  <AnimatedText
                    text="Visit Us"
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
                  Come experience the space in person. Walk through the campus
                  explore the surroundings and discover what makes this place
                  meaningful.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Info Section */}
      <section
        ref={infoSection.ref as React.RefObject<HTMLElement>}
        className="relative bg-[#F6F6F6] rounded-t-[24px] md:rounded-t-[40px] -mt-6 md:-mt-10 z-10 overflow-visible"
      >
        <div className="container px-4 sm:px-6 py-12 md:py-16 lg:py-20">
          <div className="flex flex-col lg:flex-row justify-between items-start gap-8 lg:gap-16">
            {/* Left Side - Info Blocks with Dividers */}
            <div className="flex-1 max-w-xl">
              {/* Location */}
              <div
                className="pb-6 md:pb-8 border-b border-gray-200 transition-all duration-700"
                style={{
                  opacity: infoSection.isInView ? 1 : 0,
                  transform: infoSection.isInView
                    ? "translateY(0)"
                    : "translateY(20px)",
                  transitionDelay: "200ms",
                }}
              >
                <h3 className="text-gray-900 text-base md:text-lg font-semibold mb-2">
                  Location
                </h3>
                <p className="text-gray-600 text-xs md:text-sm font-light leading-relaxed">
                  Our Sacred Space
                  <br />
                  Secunderabad Hyderabad
                </p>
              </div>

              {/* When to Visit */}
              <div
                className="py-6 md:py-8 border-b border-gray-200 transition-all duration-700"
                style={{
                  opacity: infoSection.isInView ? 1 : 0,
                  transform: infoSection.isInView
                    ? "translateY(0)"
                    : "translateY(20px)",
                  transitionDelay: "400ms",
                }}
              >
                <h3 className="text-gray-900 text-base md:text-lg font-semibold mb-2">
                  When to Visit
                </h3>
                <p className="text-gray-600 text-xs md:text-sm font-light leading-relaxed">
                  The campus is active through the week with classes workshops
                  and events.
                  <br />
                  Timings may vary based on activities.
                </p>
              </div>

              {/* Getting Here */}
              <div
                className="pt-6 md:pt-8 border-b border-gray-200 pb-6 md:pb-8 transition-all duration-700"
                style={{
                  opacity: infoSection.isInView ? 1 : 0,
                  transform: infoSection.isInView
                    ? "translateY(0)"
                    : "translateY(20px)",
                  transitionDelay: "600ms",
                }}
              >
                <h3 className="text-gray-900 text-base md:text-lg font-semibold mb-2">
                  Getting Here
                </h3>
                <p className="text-gray-600 text-xs md:text-sm font-light leading-relaxed">
                  The space is easily accessible by road and public transport.
                  <br />
                  Parking is available nearby.
                </p>
              </div>
            </div>

            {/* Right Side - Reach Out Card */}
            <div
              className="w-full lg:w-auto lg:flex-shrink-0 transition-all duration-700"
              style={{
                opacity: infoSection.isInView ? 1 : 0,
                transform: infoSection.isInView
                  ? "translateX(0)"
                  : "translateX(20px)",
                transitionDelay: "400ms",
              }}
            >
              <div className="relative w-full lg:w-[415px] xl:w-[380px] h-[315px] md:h-[415px] rounded-3xl overflow-hidden">
                {/* Background Video */}
                <img
                  src="https://umxpjtfekclktbtomiaz.supabase.co/storage/v1/object/public/Assets/images/visitImg.png"
                  alt="Reach out background"
                  className="absolute inset-0 h-full w-full object-cover object-center scale-150"
                />

                {/* Dark Overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-gray-500/60 to-black/60" />

                {/* Content */}
                <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-8">
                  <h3 className="text-white text-xl md:text-2xl font-medium mb-2">
                    Reach Out
                  </h3>
                  <p className="text-white/80 text-xs md:text-sm font-light leading-relaxed mb-4">
                    For enquiries bookings or general
                    <br />
                    information you can get in touch with us.
                  </p>
                  <a
                    href="/contact"
                    className="inline-flex items-center justify-center w-fit px-5 py-2.5 bg-[#C23536] hover:bg-[#a82d2e] text-white text-sm font-medium rounded-lg transition-all duration-200 hover:shadow-lg"
                    tabIndex={0}
                    aria-label="Contact Us"
                  >
                    Contact Us
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Community + Contact Combined Section */}
      <section
        ref={contactSection.ref as React.RefObject<HTMLElement>}
        className="relative bg-[#F6F6F6] py-10 sm:py-12 md:py-16 lg:py-20 overflow-hidden"
      >
        <div className="container px-4 sm:px-6">
          {/* Community Content */}
          <div
            className="max-w-sm sm:max-w-md md:max-w-xl mx-auto text-center md:text-left md:mx-0 transition-all duration-700"
            style={{
              opacity: contactSection.isInView ? 1 : 0,
              transform: contactSection.isInView
                ? "translateY(0)"
                : "translateY(30px)",
            }}
          >
            <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-semibold text-gray-900 mb-3 sm:mb-4">
              Community and Culture
            </h2>

            <p
              className="text-xs sm:text-sm md:text-base text-gray-600 font-light leading-relaxed transition-all duration-700"
              style={{
                opacity: contactSection.isInView ? 1 : 0,
                transform: contactSection.isInView
                  ? "translateY(0)"
                  : "translateY(20px)",
                transitionDelay: "150ms",
              }}
            >
              We support local makers, organic markets, children-focused spaces
              and environmental initiatives. Everything we do is built around
              people's craft and care for nature.
            </p>
          </div>

          {/* spacing */}
          <div className="h-16 sm:h-24 md:h-32"></div>

          {/* Contact Content */}
          <div
            className="max-w-sm sm:max-w-md md:max-w-xl mx-auto text-center md:text-left md:mx-0 transition-all duration-700"
            style={{
              opacity: contactSection.isInView ? 1 : 0,
              transform: contactSection.isInView
                ? "translateY(0)"
                : "translateY(30px)",
              transitionDelay: "200ms",
            }}
          >
            <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-semibold text-gray-900 mb-2 sm:mb-3">
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
              className="text-xs sm:text-sm md:text-base text-gray-600 font-light mb-5 sm:mb-6 transition-all duration-700"
              style={{
                opacity: contactSection.isInView ? 1 : 0,
                transform: contactSection.isInView
                  ? "translateY(0)"
                  : "translateY(20px)",
                transitionDelay: "300ms",
              }}
            >
              Reach out to schedule a visit or learn more about the space.
            </p>

            <div
              style={{
                opacity: contactSection.isInView ? 1 : 0,
                transform: contactSection.isInView
                  ? "translateY(0)"
                  : "translateY(20px)",
                transition: "all 0.7s ease-out",
                transitionDelay: "450ms",
              }}
            >
              <MagneticButton
                className="w-full sm:w-auto px-5 sm:px-6 py-2.5 sm:py-3 bg-[#c44536] hover:bg-[#a33a2d] text-white text-xs sm:text-sm font-medium rounded-3xl transition-all duration-200 hover:shadow-xl hover:shadow-gray-800/30 flex items-center justify-center gap-2 group"
                onClick={() => (window.location.href = "/contact")}
              >
                Contact Us
              </MagneticButton>
            </div>
          </div>
        </div>

        {/* Tree image inside section */}
        <img
          src="https://umxpjtfekclktbtomiaz.supabase.co/storage/v1/object/public/Assets/images/tree.png"
          alt="tree"
          className="absolute lg:-bottom-60 md:-bottom-56 bottom-[-260px] lg:right-32 md:-right-12 -right-20 
               w-[675px] xl:w-[520px] h-auto object-contain opacity-20 pointer-events-none select-none"
          aria-hidden="true"
        />
      </section>
    </div>
  );
}
