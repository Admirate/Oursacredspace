"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";

const HERO_VIDEO_URL = "https://umxpjtfekclktbtomiaz.supabase.co/storage/v1/object/public/Assets/videos/plantingtrees.mp4";

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
  const getDelay = (index: number) => delay + index * 30;
  
  return (
    <span className={className}>
      {text.split('').map((char, index) => (
        <span
          key={index}
          className="inline-block transition-all duration-500 ease-out"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
            transitionDelay: getDelay(index) + 'ms',
          }}
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </span>
  );
};
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

export default function InitiativesPage() {
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  
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

  const getTransform = () => {
    const x = mousePosition.x * 0.5;
    const y = mousePosition.y * 0.5;
    return 'scale(1.05) translate(' + x + 'px, ' + y + 'px)';
  };

  const getHeroClass = () => {
    const base = 'mt-2 xs:mt-3 md:mt-4 text-xs xs:text-sm md:text-base lg:text-lg text-white/90 max-w-[260px] xs:max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg font-light transition-all duration-1000 ease-out leading-relaxed';
    return base + ' ' + (heroLoaded ? 'opacity-100 translate-y-0 delay-500' : 'opacity-0 translate-y-8');
  };

  return (
    <div>
      <section className="relative bg-[#FFE5EC] py-4 xs:py-6 sm:py-8 md:py-10">
        <div className="container px-3 xs:px-4 flex justify-center">
          <div className="relative w-full max-w-[1414px] p-3 xs:p-4 sm:p-5 md:p-[40px] bg-[#FFE5EC] rounded-[16px] xs:rounded-[20px] sm:rounded-[24px] md:rounded-[40px]">
            <div className="relative overflow-hidden shadow-xl sm:shadow-2xl w-full h-[480px] xs:h-[520px] sm:h-[450px] md:h-[418px] lg:h-[498px] xl:h-[550px] rounded-[16px] xs:rounded-[20px] sm:rounded-[24px] md:rounded-[40px] group">
              <img
                src="https://umxpjtfekclktbtomiaz.supabase.co/storage/v1/object/public/Assets/images/initiativeHero.jpg"
                alt="Classes background"
                className="absolute inset-0 h-full w-full object-cover object-top scale-105 "
              />
              <div className="absolute inset-0 bg-gradient-to-b from-gray-500/60 to-black/60" />

              <div className="absolute inset-0 flex flex-col sm:flex-row sm:justify-between px-4 xs:px-5 sm:px-6 md:px-10 lg:px-16 py-4 xs:py-5 sm:py-8 md:py-12">
                {/* Left Section - Title and Description */}
                <div className="flex flex-col justify-center max-w-[280px] xs:max-w-xs sm:max-w-sm md:max-w-md">
                  <h1 className="text-xl xs:text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-[600] text-white tracking-wide whitespace-nowrap">
                    <AnimatedText
                      text="Initiatives"
                      isVisible={heroLoaded}
                      className="block"
                    />
                  </h1>
                  <p
                    className={getHeroClass()}
                    style={{ transitionDelay: "600ms" }}
                  >
                    We believe care for culture and care for the environment go
                    together. Our initiatives reflect this responsibility and
                    grow through collective participation.
                  </p>
                </div>

                {/* Right Section - Three Info Cards */}

                <div className="flex flex-col justify-center gap-4 xs:gap-5 sm:gap-6 mt-4 xs:mt-5 sm:mt-0 max-w-[280px] xs:max-w-xs sm:max-w-[220px] md:max-w-xs lg:max-w-sm">
                  <div className="block sm:hidden w-full border-t-2 border-white/40 mb-4"></div>
                  {/* Item */}
                  <div
                    className="transition-all duration-700 border-b-2 border-white/40 pb-4 xs:pb-5 sm:pb-6"
                    style={{
                      opacity: heroLoaded ? 1 : 0,
                      transform: heroLoaded
                        ? "translateX(0)"
                        : "translateX(20px)",
                      transitionDelay: "400ms",
                    }}
                  >
                    <h3 className="text-white text-sm xs:text-base md:text-lg font-medium mb-1">
                      The Treedom Movement
                    </h3>
                    <p className="text-white/80 text-[10px] xs:text-xs md:text-sm font-light leading-relaxed">
                      An ongoing effort focused on planting trees and nurturing
                      green spaces. It encourages awareness responsibility and
                      long term thinking.
                    </p>
                  </div>

                  {/* Item */}
                  <div
                    className="transition-all duration-700 border-b-2 border-white/40 pb-4 xs:pb-5 sm:pb-6"
                    style={{
                      opacity: heroLoaded ? 1 : 0,
                      transform: heroLoaded
                        ? "translateX(0)"
                        : "translateX(20px)",
                      transitionDelay: "600ms",
                    }}
                  >
                    <h3 className="text-white text-sm xs:text-base md:text-lg font-medium mb-1">
                      What We Do
                    </h3>
                    <p className="text-white/80 text-[10px] xs:text-xs md:text-sm font-light leading-relaxed">
                      Tree planting drives environmental conversations and
                      community led action. Each activity is rooted in care for
                      the land and future generations.
                    </p>
                  </div>

                  {/* Item */}
                  <div
                    className="transition-all duration-700 border-b-2 border-white/40 pb-4 xs:pb-5 sm:pb-6"
                    style={{
                      opacity: heroLoaded ? 1 : 0,
                      transform: heroLoaded
                        ? "translateX(0)"
                        : "translateX(20px)",
                      transitionDelay: "800ms",
                    }}
                  >
                    <h3 className="text-white text-sm xs:text-base md:text-lg font-medium mb-1">
                      Community Involvement
                    </h3>
                    <p className="text-white/80 text-[10px] xs:text-xs md:text-sm font-light leading-relaxed">
                      Everyone is welcome to participate contribute and support
                      the movement. The initiative grows through shared effort
                      and sustained commitment.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* White Content Section with Rounded Top Corners */}
      <section className="relative bg-white rounded-t-[24px] md:rounded-t-[40px] -mt-6 md:-mt-10 z-10">
        {/* Community and Culture Section */}
        <section className="relative bg-white py-10 sm:py-12 md:py-16 lg:py-20 overflow-hidden">
          <div className="container px-4 sm:px-6 relative ">
            <img
              src="https://umxpjtfekclktbtomiaz.supabase.co/storage/v1/object/public/Assets/images/tree.png"
              alt="tree"
              className="absolute lg:-bottom-80 md:-bottom-56 bottom-[-260px] lg:right-32 md:-right-12 -right-20 w-[420px]
            xl:w-[520px] h-auto object-contain opacity-20 pointer-events-none select-none"
              aria-hidden="true"
            />
            {/* Community and Culture */}
            <div
              ref={communitySection.ref as React.RefObject<HTMLDivElement>}
              className="max-w-sm sm:max-w-md md:max-w-xl mx-auto text-center md:text-left md:mx-0 transition-all duration-700"
              style={{
                opacity: communitySection.isInView ? 1 : 0,
                transform: communitySection.isInView
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
                  opacity: communitySection.isInView ? 1 : 0,
                  transform: communitySection.isInView
                    ? "translateY(0)"
                    : "translateY(20px)",
                  transitionDelay: "200ms",
                }}
              >
                We support local makers, organic markets, children-focused
                spaces and environmental initiatives. Everything we do is built
                around people&apos;s craft and care for nature.
              </p>
            </div>

            {/* spacing between two blocks */}
            <div className="h-10 md:h-14 lg:h-16" />

            {/* Visit Us */}
            <div
              ref={visitSection.ref as React.RefObject<HTMLDivElement>}
              className="max-w-sm sm:max-w-md md:max-w-xl mx-auto text-center md:text-left md:mx-0 transition-all duration-700"
              style={{
                opacity: visitSection.isInView ? 1 : 0,
                transform: visitSection.isInView
                  ? "translateY(0)"
                  : "translateY(30px)",
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
                <RippleButton
                  href="contact"
                  className="inline-flex items-center justify-center w-full sm:w-auto px-5 sm:px-6 py-3 sm:py-3 bg-[#c44536] hover:bg-[#a33a2d] text-white text-xs sm:text-sm font-medium rounded-3xl transition-all duration-200 hover:shadow-lg hover:scale-105"
                >
                  Contact Us
                </RippleButton>
              </div>
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}