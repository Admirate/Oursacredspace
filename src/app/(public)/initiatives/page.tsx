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

    </div>
  );
}