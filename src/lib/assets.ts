/**
 * Supabase Storage Assets Helper
 * 
 * All website images are stored in Supabase Storage for:
 * - CDN delivery (fast loading from edge)
 * - Easy updates (no deploy needed)
 * - Better LCP scores
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const ASSETS_BUCKET = 'Assets'; // Capital A to match Supabase bucket name

/**
 * Get the full URL for an asset in Supabase Storage
 * @param path - Path to the asset (e.g., 'hero/banner.webp' or 'classes/yoga.webp')
 * @returns Full Supabase Storage URL
 */
export const getAssetUrl = (path: string): string => {
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${SUPABASE_URL}/storage/v1/object/public/${ASSETS_BUCKET}/${cleanPath}`;
};

/**
 * Asset paths organized by section
 * Update these paths after uploading to Supabase Storage
 */
export const assets = {
  // Brand
  logo: getAssetUrl('brand/logo.png'),
  logoWhite: getAssetUrl('brand/logo-white.png'),
  favicon: getAssetUrl('brand/favicon.ico'),

  // Hero section
  hero: {
    main: getAssetUrl('hero/main.webp'),
    background: getAssetUrl('hero/background.webp'),
  },

  // Classes section
  classes: {
    placeholder: getAssetUrl('classes/placeholder.webp'),
    yoga: getAssetUrl('classes/yoga.webp'),
    meditation: getAssetUrl('classes/meditation.webp'),
    fitness: getAssetUrl('classes/fitness.webp'),
  },

  // Events section
  events: {
    placeholder: getAssetUrl('events/placeholder.webp'),
    workshop: getAssetUrl('events/workshop.webp'),
    seminar: getAssetUrl('events/seminar.webp'),
  },

  // Space booking
  space: {
    main: getAssetUrl('space/main.webp'),
    gallery: [
      getAssetUrl('space/gallery-1.webp'),
      getAssetUrl('space/gallery-2.webp'),
      getAssetUrl('space/gallery-3.webp'),
    ],
  },

  // About/Team
  about: {
    team: getAssetUrl('about/team.webp'),
    story: getAssetUrl('about/story.webp'),
  },

  // Icons (if not using Lucide)
  icons: {
    calendar: getAssetUrl('icons/calendar.svg'),
    location: getAssetUrl('icons/location.svg'),
    clock: getAssetUrl('icons/clock.svg'),
  },

  // Backgrounds & Patterns
  backgrounds: {
    pattern: getAssetUrl('backgrounds/pattern.svg'),
    gradient: getAssetUrl('backgrounds/gradient.webp'),
  },
};

/**
 * Generate blur placeholder data URL
 * Use this for the blurDataURL prop in Next.js Image
 */
export const blurPlaceholder = 
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUH/8QAIhAAAgEDBAMBAAAAAAAAAAAAAQIDAAQRBRIhMQYTQWH/xAAVAQEBAAAAAAAAAAAAAAAAAAADBP/EABkRAAIDAQAAAAAAAAAAAAAAAAECABEhA//aAAwDAQACEQMRAD8AydNR1C3066tNPvZre2uABPHE5VZMdZA6NQtF8copied4o0qWS5ur6C8nml9rO7Kd2wAAADgAAAAUUV0RAh7JmzLZ/9k=';

/**
 * Image dimensions for common use cases
 * Helps with proper aspect ratios and prevents layout shift
 */
export const imageSizes = {
  hero: { width: 1920, height: 800 },
  card: { width: 400, height: 300 },
  thumbnail: { width: 200, height: 150 },
  avatar: { width: 80, height: 80 },
  logo: { width: 150, height: 50 },
  gallery: { width: 600, height: 400 },
};

/**
 * Video assets
 * Store videos in Supabase Storage under 'videos/' folder
 */
export const videos = {
  heroBackground: getAssetUrl('videos/hero-background.mp4'),
  classesPromo: getAssetUrl('videos/classes-promo.mp4'),
  spaceTour: getAssetUrl('videos/space-tour.mp4'),
  eventsHighlight: getAssetUrl('videos/events-highlight.mp4'),
};

/**
 * Get video URL helper
 */
export const getVideoUrl = (path: string): string => {
  return getAssetUrl(`videos/${path}`);
};
