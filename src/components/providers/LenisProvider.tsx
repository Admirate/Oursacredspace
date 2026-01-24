"use client";

import { ReactNode, useEffect, useRef } from "react";
import Lenis from "lenis";

interface LenisProviderProps {
  children: ReactNode;
}

/**
 * LenisProvider - Smooth scroll provider using Lenis
 * 
 * Features:
 * - Buttery smooth scrolling
 * - Configurable duration and easing
 * - Works with scroll-linked animations
 * - Accessible (respects reduced motion)
 */
export const LenisProvider = ({ children }: LenisProviderProps) => {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Add class to html to prevent double scrollbar
    document.documentElement.classList.add("lenis-smooth");

    // Initialize Lenis
    const lenis = new Lenis({
      duration: prefersReducedMotion ? 0 : 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // Ease out expo
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
      infinite: false,
    });

    lenisRef.current = lenis;

    // Animation frame loop
    const raf = (time: number) => {
      lenis.raf(time);
      requestAnimationFrame(raf);
    };

    requestAnimationFrame(raf);

    // Expose lenis to window for debugging and external access
    if (typeof window !== "undefined") {
      (window as any).lenis = lenis;
    }

    // Cleanup
    return () => {
      lenis.destroy();
      lenisRef.current = null;
      document.documentElement.classList.remove("lenis-smooth");
    };
  }, []);

  return <>{children}</>;
};

export default LenisProvider;
