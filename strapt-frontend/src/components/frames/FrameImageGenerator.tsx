import React, { useRef, useEffect } from 'react';

interface FrameImageGeneratorProps {
  title: string;
  subtitle?: string;
  amount?: string;
  token?: string;
  status?: 'success' | 'error' | 'pending' | 'info';
  width?: number;
  height?: number;
  onImageGenerated?: (dataUrl: string) => void;
}

/**
 * Component that generates frame images using Canvas API
 * Can be used to create dynamic images for frame metadata
 */
export const FrameImageGenerator: React.FC<FrameImageGeneratorProps> = ({
  title,
  subtitle,
  amount,
  token,
  status,
  width = 764,
  height = 400,
  onImageGenerated,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    
    if (!canvas || !ctx) return;

    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(1, '#16213e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // STRAPT branding
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('STRAPT', width / 2, 60);

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
    ctx.fillText(title, width / 2, 120);

    // Subtitle
    if (subtitle) {
      ctx.fillStyle = '#cccccc';
      ctx.font = '20px system-ui, -apple-system, sans-serif';
      ctx.fillText(subtitle, width / 2, 160);
    }

    // Amount and token
    if (amount && token) {
      ctx.fillStyle = '#4ade80';
      ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
      ctx.fillText(`${amount} ${token}`, width / 2, 220);
    }

    // Status indicator
    if (status) {
      const statusColors = {
        success: '#22c55e',
        error: '#ef4444',
        pending: '#f59e0b',
        info: '#3b82f6',
      };

      // Status circle
      ctx.fillStyle = statusColors[status];
      ctx.beginPath();
      ctx.arc(width / 2, 280, 20, 0, 2 * Math.PI);
      ctx.fill();

      // Status text
      ctx.fillStyle = '#ffffff';
      ctx.font = '18px system-ui, -apple-system, sans-serif';
      const statusText = status.charAt(0).toUpperCase() + status.slice(1);
      ctx.fillText(statusText, width / 2, 320);
    }

    // Footer
    ctx.fillStyle = '#888888';
    ctx.font = '14px system-ui, -apple-system, sans-serif';
    ctx.fillText('Powered by STRAPT Protocol', width / 2, 370);

    // Generate data URL and call callback
    const dataUrl = canvas.toDataURL('image/png');
    onImageGenerated?.(dataUrl);
  }, [title, subtitle, amount, token, status, width, height, onImageGenerated]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'none' }}
      width={width}
      height={height}
    />
  );
};

/**
 * Hook for generating frame images
 */
export const useFrameImageGenerator = () => {
  const generateImage = (config: Omit<FrameImageGeneratorProps, 'onImageGenerated'>) => {
    return new Promise<string>((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        resolve('');
        return;
      }

      const { width = 764, height = 400, title, subtitle, amount, token, status } = config;

      canvas.width = width;
      canvas.height = height;

      // Background gradient
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, '#1a1a2e');
      gradient.addColorStop(1, '#16213e');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // STRAPT branding
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 32px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('STRAPT', width / 2, 60);

      // Title
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
      ctx.fillText(title, width / 2, 120);

      // Subtitle
      if (subtitle) {
        ctx.fillStyle = '#cccccc';
        ctx.font = '20px system-ui, -apple-system, sans-serif';
        ctx.fillText(subtitle, width / 2, 160);
      }

      // Amount and token
      if (amount && token) {
        ctx.fillStyle = '#4ade80';
        ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
        ctx.fillText(`${amount} ${token}`, width / 2, 220);
      }

      // Status indicator
      if (status) {
        const statusColors = {
          success: '#22c55e',
          error: '#ef4444',
          pending: '#f59e0b',
          info: '#3b82f6',
        };

        ctx.fillStyle = statusColors[status];
        ctx.beginPath();
        ctx.arc(width / 2, 280, 20, 0, 2 * Math.PI);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = '18px system-ui, -apple-system, sans-serif';
        const statusText = status.charAt(0).toUpperCase() + status.slice(1);
        ctx.fillText(statusText, width / 2, 320);
      }

      // Footer
      ctx.fillStyle = '#888888';
      ctx.font = '14px system-ui, -apple-system, sans-serif';
      ctx.fillText('Powered by STRAPT Protocol', width / 2, 370);

      resolve(canvas.toDataURL('image/png'));
    });
  };

  return { generateImage };
};
