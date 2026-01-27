"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

// Video URL from Supabase Storage - update with your community video
const HERO_VIDEO_URL = "https://umxpjtfekclktbtomiaz.supabase.co/storage/v1/object/public/Assets/videos/roof.mp4";

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

export default function CommunityPage() {
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  
  const aboutSection = useInView(0.1);
  const communitySection = useInView(0.1);
  const visitSection = useInView(0.1);

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
                aria-label="Community video background"
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
                  <AnimatedText text="Community Spaces" isVisible={heroLoaded} className="block" />
                </h1>
                <p 
                  className={`mt-3 md:mt-4 text-sm md:text-base lg:text-lg text-white/90 max-w-md lg:max-w-lg font-light transition-all duration-1000 ease-out ${
                    heroLoaded ? "opacity-100 translate-y-0 delay-500" : "opacity-0 translate-y-8"
                  }`}
                  style={{ transitionDelay: '600ms' }}
                >
                  We have spaces that exist beyond classes and events.
                  <br />
                  They are meant for browsing reading meeting and spending unstructured time.
                </p>
                
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Community Section */}
      <section 
        ref={aboutSection.ref as React.RefObject<HTMLElement>}
        className="relative bg-white rounded-t-[24px] md:rounded-t-[40px] -mt-6 md:-mt-10 z-10"
      >
        <div className="container px-4 sm:px-6 py-12 md:py-16 lg:py-20">
          <div className="flex flex-col lg:flex-row justify-between items-start gap-8 lg:gap-16">
            {/* Left Side - Info Blocks */}
            <div className="flex-1 max-w-2xl space-y-8 md:space-y-10">
              {/* Adivaram Angadi */}
              <div 
                className="transition-all duration-700"
                style={{
                  opacity: aboutSection.isInView ? 1 : 0,
                  transform: aboutSection.isInView ? 'translateY(0)' : 'translateY(20px)',
                  transitionDelay: '200ms',
                }}
              >
                <h3 className="text-gray-900 text-base md:text-lg font-semibold mb-2">Adivaram Angadi</h3>
                <p className="text-gray-600 text-xs md:text-sm font-light leading-relaxed">
                  A space that brings together handcrafted goods sustainable products and local makers.
                  <br />
                  It supports mindful living and conscious choices.
                </p>
              </div>
              
              {/* Children's Reading Room */}
              <div 
                className="transition-all duration-700"
                style={{
                  opacity: aboutSection.isInView ? 1 : 0,
                  transform: aboutSection.isInView ? 'translateY(0)' : 'translateY(20px)',
                  transitionDelay: '400ms',
                }}
              >
                <h3 className="text-gray-900 text-base md:text-lg font-semibold mb-2">Children&apos;s Reading Room</h3>
                <p className="text-gray-600 text-xs md:text-sm font-light leading-relaxed">
                  A quiet welcoming space created especially for children.
                  <br />
                  It encourages curiosity imagination and time spent with books.
                </p>
              </div>
              
              {/* Handicraft Shop */}
              <div 
                className="transition-all duration-700"
                style={{
                  opacity: aboutSection.isInView ? 1 : 0,
                  transform: aboutSection.isInView ? 'translateY(0)' : 'translateY(20px)',
                  transitionDelay: '600ms',
                }}
              >
                <h3 className="text-gray-900 text-base md:text-lg font-semibold mb-2">Handicraft Shop</h3>
                <p className="text-gray-600 text-xs md:text-sm font-light leading-relaxed">
                  A place that celebrates traditional craft and handmade work.
                  <br />
                  Each piece reflects skill patience and cultural heritage.
                </p>
              </div>
              
              {/* Organic Market */}
              <div 
                className="transition-all duration-700"
                style={{
                  opacity: aboutSection.isInView ? 1 : 0,
                  transform: aboutSection.isInView ? 'translateY(0)' : 'translateY(20px)',
                  transitionDelay: '800ms',
                }}
              >
                <h3 className="text-gray-900 text-base md:text-lg font-semibold mb-2">Organic Market</h3>
                <p className="text-gray-600 text-xs md:text-sm font-light leading-relaxed">
                  A market that supports organic produce natural products and sustainable alternatives.
                  <br />
                  It connects growers makers and the community.
                </p>
              </div>
            </div>
            
            {/* Right Side - Decorative Mandala */}
            <div className="hidden lg:flex items-center justify-center flex-shrink-0">
              <div className="relative w-[250px] h-[250px] xl:w-[300px] xl:h-[300px]">
                <Image
                  src="https://umxpjtfekclktbtomiaz.supabase.co/storage/v1/object/public/Assets/images/wheel.png"
                  alt=""
                  aria-hidden="true"
                  fill
                  sizes="(max-width: 1280px) 250px, 300px"
                  className="object-contain opacity-20"
                />
              </div>
            </div>
          </div>
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
    </div>
  );
}
