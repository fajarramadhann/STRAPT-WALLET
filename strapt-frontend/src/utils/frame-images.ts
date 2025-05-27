/**
 * Utilities for generating frame images
 * Since we're using Vite (not Next.js), we'll create static images or use a service
 */

export interface FrameImageConfig {
  title: string;
  subtitle?: string;
  amount?: string;
  token?: string;
  step?: string;
  status?: 'success' | 'error' | 'pending' | 'info';
  background?: string;
  logo?: string;
}

/**
 * Generate frame image URL using a service or static images
 */
export function generateFrameImageUrl(config: FrameImageConfig): string {
  const baseUrl = window.location.origin;
  
  // For now, we'll use static images based on the frame type
  // In production, you might want to use a dynamic image generation service
  
  if (config.step === 'success') {
    return `${baseUrl}/assets/frame-success.png`;
  }
  
  if (config.step === 'error') {
    return `${baseUrl}/assets/frame-error.png`;
  }
  
  if (config.title.includes('Transfer')) {
    return `${baseUrl}/assets/frame-transfer.png`;
  }
  
  if (config.title.includes('Drop')) {
    return `${baseUrl}/assets/frame-drop.png`;
  }
  
  // Default frame image
  return `${baseUrl}/assets/frame-default.png`;
}

/**
 * Generate dynamic frame image using Canvas API (client-side)
 */
export function generateDynamicFrameImage(config: FrameImageConfig): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      resolve(generateFrameImageUrl(config));
      return;
    }
    
    // Set canvas size for frame (1.91:1 aspect ratio)
    canvas.width = 764;
    canvas.height = 400;
    
    // Background
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, config.background || '#1a1a2e');
    gradient.addColorStop(1, config.background || '#16213e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // STRAPT logo/branding
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('STRAPT', canvas.width / 2, 60);
    
    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px Arial';
    ctx.fillText(config.title, canvas.width / 2, 120);
    
    // Subtitle
    if (config.subtitle) {
      ctx.fillStyle = '#cccccc';
      ctx.font = '20px Arial';
      ctx.fillText(config.subtitle, canvas.width / 2, 160);
    }
    
    // Amount and token
    if (config.amount && config.token) {
      ctx.fillStyle = '#4ade80';
      ctx.font = 'bold 36px Arial';
      ctx.fillText(`${config.amount} ${config.token}`, canvas.width / 2, 220);
    }
    
    // Status indicator
    if (config.status) {
      const statusColors = {
        success: '#22c55e',
        error: '#ef4444',
        pending: '#f59e0b',
        info: '#3b82f6',
      };
      
      ctx.fillStyle = statusColors[config.status];
      ctx.beginPath();
      ctx.arc(canvas.width / 2, 280, 20, 0, 2 * Math.PI);
      ctx.fill();
      
      // Status text
      ctx.fillStyle = '#ffffff';
      ctx.font = '18px Arial';
      const statusText = config.status.charAt(0).toUpperCase() + config.status.slice(1);
      ctx.fillText(statusText, canvas.width / 2, 320);
    }
    
    // Footer
    ctx.fillStyle = '#888888';
    ctx.font = '14px Arial';
    ctx.fillText('Powered by STRAPT Protocol', canvas.width / 2, 370);
    
    // Convert to data URL
    resolve(canvas.toDataURL('image/png'));
  });
}

/**
 * Create static frame images for common scenarios
 */
export const FRAME_IMAGES = {
  transfer: {
    default: '/assets/frame-transfer-default.png',
    success: '/assets/frame-transfer-success.png',
    error: '/assets/frame-transfer-error.png',
  },
  drop: {
    create: '/assets/frame-drop-create.png',
    claim: '/assets/frame-drop-claim.png',
    success: '/assets/frame-drop-success.png',
    claimed: '/assets/frame-drop-claimed.png',
  },
  general: {
    welcome: '/assets/frame-welcome.png',
    loading: '/assets/frame-loading.png',
    error: '/assets/frame-error.png',
  },
};

/**
 * Get appropriate frame image based on context
 */
export function getFrameImage(
  type: 'transfer' | 'drop' | 'general',
  state: string,
  config?: FrameImageConfig
): string {
  const baseUrl = window.location.origin;
  
  // Try to get static image first
  const staticImage = FRAME_IMAGES[type]?.[state as keyof typeof FRAME_IMAGES[typeof type]];
  if (staticImage) {
    return `${baseUrl}${staticImage}`;
  }
  
  // Fallback to generated image
  if (config) {
    return generateFrameImageUrl(config);
  }
  
  // Ultimate fallback
  return `${baseUrl}/placeholder.svg`;
}

/**
 * Preload frame images for better performance
 */
export function preloadFrameImages() {
  const imagesToPreload = [
    ...Object.values(FRAME_IMAGES.transfer),
    ...Object.values(FRAME_IMAGES.drop),
    ...Object.values(FRAME_IMAGES.general),
  ];
  
  imagesToPreload.forEach(src => {
    const img = new Image();
    img.src = `${window.location.origin}${src}`;
  });
}

/**
 * Generate frame metadata image with text overlay
 */
export function generateMetadataImage(
  title: string,
  subtitle?: string,
  amount?: string,
  token?: string
): string {
  // For metadata, we'll use a simple approach with query parameters
  // In production, you might want to use a service like Vercel OG or similar
  const params = new URLSearchParams({
    title,
    ...(subtitle && { subtitle }),
    ...(amount && { amount }),
    ...(token && { token }),
  });
  
  return `${window.location.origin}/api/og?${params.toString()}`;
}
