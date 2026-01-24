"use client";

import Image, { ImageProps } from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { blurPlaceholder } from "@/lib/assets";

interface OptimizedImageProps extends Omit<ImageProps, "onError"> {
  fallbackSrc?: string;
}

/**
 * OptimizedImage - Next.js Image with built-in optimizations
 * 
 * Features:
 * - Blur placeholder while loading
 * - Fallback image on error
 * - Responsive by default
 * - Smooth fade-in animation
 */
export const OptimizedImage = ({
  src,
  alt,
  className,
  fallbackSrc = "/placeholder.svg",
  priority = false,
  ...props
}: OptimizedImageProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setHasError(true);
    setIsLoading(false);
  };

  return (
    <Image
      src={hasError ? fallbackSrc : src}
      alt={alt}
      className={cn(
        "duration-300 ease-in-out",
        isLoading ? "scale-105 blur-sm" : "scale-100 blur-0",
        className
      )}
      placeholder="blur"
      blurDataURL={blurPlaceholder}
      priority={priority}
      onLoad={handleLoad}
      onError={handleError}
      {...props}
    />
  );
};

export default OptimizedImage;
