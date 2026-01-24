"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Plus, Minus } from "lucide-react";
import Link from "next/link";

// Video URLs from Supabase Storage
const HERO_VIDEO_URL = "https://umxpjtfekclktbtomiaz.supabase.co/storage/v1/object/public/Assets/videos/painting.mp4";
const GROUP_VIDEO_URL = "https://umxpjtfekclktbtomiaz.supabase.co/storage/v1/object/public/Assets/videos/group.mp4";

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
const MagneticButton = ({ 
  children, 
  className, 
  href 
}: { 
  children: React.ReactNode; 
  className?: string; 
  href: string;
}) => {
  const buttonRef = useRef<HTMLAnchorElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    const button = buttonRef.current;
    if (!button) return;
    
    const rect = button.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    
    setPosition({ x: x * 0.15, y: y * 0.15 });
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


// Workshop categories data
const WORKSHOP_CATEGORIES = [
  { 
    id: "pottery", 
    title: "Pottery and Craft",
    description: "Explore the meditative art of working with clay. From hand-building to wheel throwing, our pottery sessions help you create functional and decorative pieces while finding calm in the process."
  },
  { 
    id: "art", 
    title: "Art and Creative Practice",
    description: "Discover various forms of artistic expression including painting, drawing, mixed media, and more. No prior experience needed—just bring your curiosity and willingness to explore."
  },
  { 
    id: "movement", 
    title: "Movement and Wellness",
    description: "Connect mind and body through yoga, dance, breathwork, and somatic practices. These sessions focus on gentle movement, mindfulness, and holistic well-being."
  },
  { 
    id: "music", 
    title: "Music and Culture",
    description: "Immerse yourself in sound through drumming circles, singing sessions, and explorations of traditional and contemporary music forms from around the world."
  },
  { 
    id: "group", 
    title: "Group Sessions",
    description: "Special collaborative workshops designed for teams, families, or friends. Custom experiences that bring people together through shared creative exploration."
  },
];

// Accordion Item Component with micro-interactions
const AccordionItem = ({ 
  title, 
  description,
  isOpen, 
  onToggle,
  index,
  isVisible
}: { 
  title: string; 
  description: string;
  isOpen: boolean; 
  onToggle: () => void;
  index: number;
  isVisible: boolean;
}) => {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <div 
      className={`w-full max-w-[343px] bg-[#F6F6F6]/40 backdrop-blur-sm rounded-[24px] sm:rounded-[32px] md:rounded-[38px] transition-all duration-500 ease-out overflow-hidden border-2 ${
        isOpen ? 'border-amber-400 shadow-lg shadow-amber-400/20' : 'border-transparent'
      } ${isHovered && !isOpen ? 'scale-[1.02] shadow-md' : ''}`}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateX(0)' : 'translateX(-30px)',
        transitionDelay: `${index * 100}ms`,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        onClick={onToggle}
        onKeyDown={(e) => e.key === 'Enter' && onToggle()}
        className="flex items-center justify-between w-full h-[52px] sm:h-[58px] md:h-[64px] px-4 sm:px-5 text-left text-xs sm:text-sm font-medium text-gray-800 hover:bg-[#F6F6F6]/20 transition-colors duration-200"
        aria-expanded={isOpen}
        aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${title}`}
        tabIndex={0}
      >
        <span className="transition-transform duration-200" style={{ transform: isHovered ? 'translateX(4px)' : 'translateX(0)' }}>
          {title}
        </span>
        <span 
          className="flex-shrink-0 ml-2 transition-all duration-300"
          style={{ 
            transform: isOpen ? 'rotate(180deg)' : isHovered ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        >
          {isOpen ? (
            <Minus className="w-4 h-4 sm:w-5 sm:h-5 text-sacred-pink" />
          ) : (
            <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-sacred-pink" />
          )}
        </span>
      </button>
      
      {/* Expandable Description */}
      <div 
        className={`grid transition-all duration-400 ease-out ${
          isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <p className="px-4 sm:px-5 pb-4 sm:pb-5 text-[11px] sm:text-xs text-gray-600 leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
};

export default function WorkshopsPage() {
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  
  // Section visibility hooks for scroll animations
  const whatHappensSection = useInView(0.15);
  const communitySection = useInView(0.2);
  const visitSection = useInView(0.2);

  useEffect(() => {
    const timer = setTimeout(() => setHeroLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleToggleCategory = (categoryId: string) => {
    setOpenCategory(openCategory === categoryId ? null : categoryId);
  };

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
                aria-label="Painting workshop video background"
              >
                <source src={HERO_VIDEO_URL} type="video/mp4" />
              </video>
              
              <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/30 to-transparent" />
              
              <div className="absolute inset-0 flex flex-col justify-center px-6 md:px-10 lg:px-16">
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-light text-white italic tracking-wide">
                  <AnimatedText text="Workshops" isVisible={heroLoaded} className="block" />
                </h1>
                <p 
                  className={`mt-3 md:mt-4 text-sm md:text-base lg:text-lg text-white/90 max-w-md lg:max-w-lg font-light transition-all duration-1000 ease-out ${
                    heroLoaded ? "opacity-100 translate-y-0 delay-500" : "opacity-0 translate-y-8"
                  }`}
                  style={{ transitionDelay: '600ms' }}
                >
                  We host short format sessions that invite people to slow down, learn and engage. These sessions are open to everyone regardless of experience.
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

      {/* What Happens Here Section */}
      <section 
        ref={whatHappensSection.ref as React.RefObject<HTMLElement>}
        className="relative bg-white py-8 md:py-10 rounded-t-[24px] md:rounded-t-[40px] -mt-4 md:-mt-6"
      >
        <div className="container px-4 flex justify-center">
          <div className="relative w-full max-w-[1434px] p-5 md:p-[40px] bg-white">
            <div className="relative overflow-hidden shadow-2xl w-full max-w-[1354px] min-h-[600px] sm:min-h-[650px] md:min-h-[750px] lg:min-h-[900px] xl:min-h-[1000px] rounded-[24px] md:rounded-[40px] mx-auto group">
              {/* Video Background with parallax */}
              <video
                autoPlay
                loop
                muted
                playsInline
                className="absolute inset-0 h-full w-full object-cover scale-105 transition-transform duration-1000"
                style={{
                  transform: `scale(1.05) translate(${mousePosition.x * 0.3}px, ${mousePosition.y * 0.3}px)`,
                }}
                aria-label="Group activity video background"
              >
                <source src={GROUP_VIDEO_URL} type="video/mp4" />
              </video>
              
              {/* Overlay */}
              <div className="absolute inset-0 bg-black/40" />
              
              {/* Content */}
              <div className="relative z-10 p-5 sm:p-6 md:p-8 lg:p-10 flex flex-col h-full min-h-[600px] sm:min-h-[650px] md:min-h-[750px] lg:min-h-[900px] xl:min-h-[1000px]">
                <div 
                  className="max-w-xs sm:max-w-sm md:max-w-md transition-all duration-700"
                  style={{
                    opacity: whatHappensSection.isInView ? 1 : 0,
                    transform: whatHappensSection.isInView ? 'translateY(0)' : 'translateY(20px)',
                  }}
                >
                  <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-semibold text-white mb-2 sm:mb-3 italic">
                    What Happens Here
                  </h2>
                  <p className="text-xs sm:text-sm md:text-base text-white/80 font-light leading-relaxed">
                    Hands-on sessions across art, craft, movement, music and cultural practices. 
                    Each workshop is designed to be accessible, thoughtful and rooted in practice.
                  </p>
                </div>
                
                {/* Accordion Categories with staggered animation */}
                <div className="mt-5 sm:mt-6 md:mt-8 flex flex-col gap-3 sm:gap-4 md:gap-[18px]">
                  {WORKSHOP_CATEGORIES.map((category, index) => (
                    <AccordionItem
                      key={category.id}
                      title={category.title}
                      description={category.description}
                      isOpen={openCategory === category.id}
                      onToggle={() => handleToggleCategory(category.id)}
                      index={index}
                      isVisible={whatHappensSection.isInView}
                    />
                  ))}
                </div>
                
                {/* Enquire Button with magnetic effect */}
                <div 
                  className="mt-auto pt-6 sm:pt-8 flex justify-center sm:justify-end"
                  style={{
                    opacity: whatHappensSection.isInView ? 1 : 0,
                    transform: whatHappensSection.isInView ? 'translateY(0)' : 'translateY(20px)',
                    transition: 'all 0.7s ease-out',
                    transitionDelay: '600ms',
                  }}
                >
                  <MagneticButton
                    href="/book-space"
                    className="w-full sm:w-[150px] md:w-[175px] h-[48px] sm:h-[50px] md:h-[52px] flex items-center justify-center bg-[#C23536] hover:bg-[#a82d2e] text-white text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 hover:shadow-lg hover:shadow-[#C23536]/30"
                  >
                    Enquire
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
              <RippleButton
                href="/book-space"
                className="inline-flex items-center justify-center w-full sm:w-auto px-5 sm:px-6 py-2.5 sm:py-3 bg-gray-800 hover:bg-gray-900 text-white text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 hover:shadow-lg hover:scale-105"
              >
                Contact Us
              </RippleButton>
            </div>
          </div>
        </div>
        
        {/* Decorative Spinning Mandala */}
        <div className="mt-12 md:mt-16 flex justify-center">
          <div className="relative w-[200px] h-[200px] md:w-[300px] md:h-[300px]">
            <img
              src="https://umxpjtfekclktbtomiaz.supabase.co/storage/v1/object/public/Assets/images/wheel.png"
              alt=""
              aria-hidden="true"
              className="w-full h-full object-contain opacity-20 animate-spin-slow"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
