"use client";

import { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface OptimizedVideoProps {
  src: string;
  poster?: string;
  className?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  playsInline?: boolean;
  controls?: boolean;
  preload?: "auto" | "metadata" | "none";
  onLoadedData?: () => void;
}

/**
 * OptimizedVideo - Video component with performance optimizations
 * 
 * Features:
 * - Lazy loading (only loads when in viewport)
 * - Poster image while loading
 * - Autoplay with intersection observer
 * - Accessible controls
 */
export const OptimizedVideo = ({
  src,
  poster,
  className,
  autoPlay = true,
  loop = true,
  muted = true,
  playsInline = true,
  controls = false,
  preload = "metadata",
  onLoadedData,
}: OptimizedVideoProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isInView, setIsInView] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Intersection Observer for lazy loading
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            if (autoPlay && video.paused) {
              video.play().catch(() => {
                // Autoplay blocked - that's okay
              });
            }
          } else {
            if (autoPlay && !video.paused) {
              video.pause();
            }
          }
        });
      },
      { threshold: 0.25 }
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, [autoPlay]);

  const handleLoadedData = () => {
    setIsLoaded(true);
    onLoadedData?.();
  };

  return (
    <video
      ref={videoRef}
      className={cn(
        "transition-opacity duration-500",
        isLoaded ? "opacity-100" : "opacity-0",
        className
      )}
      src={isInView ? src : undefined}
      poster={poster}
      autoPlay={autoPlay}
      loop={loop}
      muted={muted}
      playsInline={playsInline}
      controls={controls}
      preload={preload}
      onLoadedData={handleLoadedData}
      aria-label="Video content"
    />
  );
};

/**
 * BackgroundVideo - Full-screen background video
 */
export const BackgroundVideo = ({
  src,
  poster,
  overlay = true,
  overlayOpacity = 0.5,
  className,
}: {
  src: string;
  poster?: string;
  overlay?: boolean;
  overlayOpacity?: number;
  className?: string;
}) => {
  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      <OptimizedVideo
        src={src}
        poster={poster}
        className="absolute inset-0 w-full h-full object-cover"
        autoPlay
        loop
        muted
        playsInline
      />
      {overlay && (
        <div
          className="absolute inset-0 bg-black"
          style={{ opacity: overlayOpacity }}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export default OptimizedVideo;
