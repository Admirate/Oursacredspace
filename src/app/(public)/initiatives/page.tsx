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
    const base = 'mt-3 md:mt-4 text-sm md:text-base lg:text-lg text-white/90 max-w-md lg:max-w-lg font-light transition-all duration-1000 ease-out';
    return base + ' ' + (heroLoaded ? 'opacity-100 translate-y-0 delay-500' : 'opacity-0 translate-y-8');
  };

  return (
    <div className="overflow-x-hidden">
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
                style={{ transform: getTransform() }}
                aria-label="Initiatives video background"
              >
                <source src={HERO_VIDEO_URL} type="video/mp4" />
              </video>
              
              <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/30 to-transparent" />
              
              <div className="absolute inset-0 flex flex-col md:flex-row justify-between px-6 md:px-10 lg:px-16 py-8 md:py-12">
                {/* Left Section */}
                <div className="flex flex-col justify-center max-w-xs md:max-w-sm">
                  <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-light text-white italic tracking-wide mb-4">
                    <AnimatedText text="Initiatives" isVisible={heroLoaded} className="block" />
                  </h1>
                  <p 
                    className={getHeroClass()}
                    style={{ transitionDelay: '600ms' }}
                  >
                    We believe care for culture and care for the environment go together. Our initiatives reflect this responsibility and grow through collective participation.
                  </p>
                </div>
                
                {/* Right Section - Three Info Cards */}
                <div className="flex flex-col justify-center gap-4 md:gap-6 mt-6 md:mt-0 max-w-xs md:max-w-md">
                  {/* The Treedom Movement */}
                  <div 
                    className="transition-all duration-700"
                    style={{
                      opacity: heroLoaded ? 1 : 0,
                      transform: heroLoaded ? 'translateX(0)' : 'translateX(20px)',
                      transitionDelay: '400ms',
                    }}
                  >
                    <h3 className="text-white text-base md:text-lg font-medium mb-1">The Treedom Movement</h3>
                    <p className="text-white/80 text-xs md:text-sm font-light leading-relaxed">
                      An ongoing effort focused on planting trees and nurturing green spaces. It encourages awareness responsibility and long term thinking.
                    </p>
                  </div>
                  
                  {/* What We Do */}
                  <div 
                    className="transition-all duration-700"
                    style={{
                      opacity: heroLoaded ? 1 : 0,
                      transform: heroLoaded ? 'translateX(0)' : 'translateX(20px)',
                      transitionDelay: '600ms',
                    }}
                  >
                    <h3 className="text-white text-base md:text-lg font-medium mb-1">What We Do</h3>
                    <p className="text-white/80 text-xs md:text-sm font-light leading-relaxed">
                      Tree planting drives environmental conversations and community led action. Each activity is rooted in care for the land and future generations.
                    </p>
                  </div>
                  
                  {/* Community Involvement */}
                  <div 
                    className="transition-all duration-700"
                    style={{
                      opacity: heroLoaded ? 1 : 0,
                      transform: heroLoaded ? 'translateX(0)' : 'translateX(20px)',
                      transitionDelay: '800ms',
                    }}
                  >
                    <h3 className="text-white text-base md:text-lg font-medium mb-1">Community Involvement</h3>
                    <p className="text-white/80 text-xs md:text-sm font-light leading-relaxed">
                      Everyone is welcome to participate contribute and support the movement. The initiative grows through shared effort and sustained commitment.
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
        <section 
          ref={communitySection.ref as React.RefObject<HTMLElement>}
          className="py-10 sm:py-12 md:py-16 lg:py-20"
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
                We support local makers organic markets children-focused spaces and environmental initiatives. 
                Everything we do is built around people&apos;s craft and care for nature.
              </p>
            </div>
          </div>
        </section>

        {/* Visit Us Section */}
        <section 
          ref={visitSection.ref as React.RefObject<HTMLElement>}
          className="pb-12 sm:pb-16 md:pb-20 lg:pb-24"
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
                Visit Us <span className="text-sacred-burgundy">♀</span> Also
              </h2>
              <p 
                className="text-xs sm:text-sm md:text-base text-gray-600 font-light mb-5 sm:mb-6 transition-all duration-700"
                style={{
                  opacity: visitSection.isInView ? 1 : 0,
                  transform: visitSection.isInView ? 'translateY(0)' : 'translateY(20px)',
                  transitionDelay: '150ms',
                }}
              >
                Come for a class host an event or spend time in the space.
              </p>
              <div
                style={{
                  opacity: visitSection.isInView ? 1 : 0,
                  transform: visitSection.isInView ? 'translateY(0)' : 'translateY(20px)',
                  transition: 'all 0.7s ease-out',
                  transitionDelay: '300ms',
                }}
              >
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center px-5 sm:px-6 py-2.5 sm:py-3 bg-[#C23536] hover:bg-[#a82d2e] text-white text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 hover:shadow-lg"
                  tabIndex={0}
                  aria-label="Contact Us"
                >
                  Contact Us
                </Link>
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
                className="object-contain opacity-20 animate-spin-slow"
              />
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}