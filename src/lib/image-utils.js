/**
 * Utility functions for handling image URLs
 */

/**
 * Get the base URL for uploaded images
 * @returns {string} The base URL for images
 */
export function getImageBaseUrl() {
  // Use NEXT_PUBLIC_IMAGE_BACK_URL for client-side access
  return process.env.NEXT_PUBLIC_IMAGE_BACK_URL || 'https://shoes.virgocrumbs.com/changeworks/uploads';
}

/**
 * Build a complete image URL from a filename or relative path
 * @param {string} imagePath - The image filename or relative path
 * @returns {string} Complete image URL
 */
export function buildImageUrl(imagePath) {
  if (!imagePath) return null;
  
  // If it's already a full URL, return as-is
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  // Remove leading slash if present
  const cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
  
  // Build the complete URL
  const baseUrl = getImageBaseUrl();
  return `${baseUrl}/${cleanPath}`;
}

/**
 * Build organization logo URL
 * @param {string} imageUrl - The imageUrl from database
 * @returns {string|null} Complete logo URL or null
 */
export function buildOrgLogoUrl(imageUrl) {
  if (!imageUrl) return null;
  
  // If it's already a full URL, return as-is
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  
  // Build the complete URL
  return buildImageUrl(imageUrl);
}
