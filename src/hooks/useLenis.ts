"use client";

import { useCallback } from "react";

/**
 * useLenis hook - Control Lenis smooth scroll from any component
 * 
 * Features:
 * - Scroll to element by ID or selector
 * - Scroll to top
 * - Stop/start scroll
 * - Get scroll progress
 */
export const useLenis = () => {
  // Get Lenis instance from window
  const getLenis = useCallback(() => {
    if (typeof window !== "undefined") {
      return (window as any).lenis;
    }
    return null;
  }, []);

  // Scroll to a specific element
  const scrollTo = useCallback(
    (
      target: string | HTMLElement | number,
      options?: {
        offset?: number;
        duration?: number;
        immediate?: boolean;
        lock?: boolean;
        onComplete?: () => void;
      }
    ) => {
      const lenis = getLenis();
      if (lenis) {
        lenis.scrollTo(target, {
          offset: options?.offset ?? 0,
          duration: options?.duration ?? 1.2,
          immediate: options?.immediate ?? false,
          lock: options?.lock ?? false,
          onComplete: options?.onComplete,
        });
      }
    },
    [getLenis]
  );

  // Scroll to top of page
  const scrollToTop = useCallback(
    (duration?: number) => {
      scrollTo(0, { duration: duration ?? 1.2 });
    },
    [scrollTo]
  );

  // Scroll to element by ID
  const scrollToId = useCallback(
    (id: string, offset?: number) => {
      scrollTo(`#${id}`, { offset: offset ?? -80 }); // -80 for header offset
    },
    [scrollTo]
  );

  // Stop scrolling (useful for modals)
  const stop = useCallback(() => {
    const lenis = getLenis();
    if (lenis) {
      lenis.stop();
    }
  }, [getLenis]);

  // Start scrolling
  const start = useCallback(() => {
    const lenis = getLenis();
    if (lenis) {
      lenis.start();
    }
  }, [getLenis]);

  return {
    scrollTo,
    scrollToTop,
    scrollToId,
    stop,
    start,
    getLenis,
  };
};

export default useLenis;
