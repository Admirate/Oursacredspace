"use client";

import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface HeroBackgroundVideoProps {
  src: string;
  poster?: string;
  className?: string;
}

export function HeroBackgroundVideo({
  src,
  poster,
  className,
}: HeroBackgroundVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const play = () => {
      video.play().catch(() => {});
    };

    play();
    video.addEventListener("canplay", play);

    return () => {
      video.removeEventListener("canplay", play);
    };
  }, [src]);

  return (
    <video
      ref={videoRef}
      src={src}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      poster={poster}
      className={cn(
        "absolute inset-0 h-full w-full object-cover scale-105",
        className
      )}
      aria-hidden="true"
    />
  );
}

export default HeroBackgroundVideo;
