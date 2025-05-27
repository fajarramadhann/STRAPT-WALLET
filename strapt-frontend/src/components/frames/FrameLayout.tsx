import React from 'react';
import { cn } from '@/lib/utils';

interface FrameLayoutProps {
  children: React.ReactNode;
  className?: string;
  aspectRatio?: '1:1' | '1.91:1';
  maxWidth?: number;
}

/**
 * Layout component optimized for Farcaster frames
 * Handles frame constraints and responsive design
 */
export const FrameLayout: React.FC<FrameLayoutProps> = ({
  children,
  className,
  aspectRatio = '1.91:1',
  maxWidth = 600,
}) => {
  const aspectRatioClass = aspectRatio === '1:1' ? 'aspect-square' : 'aspect-[1.91/1]';

  return (
    <div
      className={cn(
        'w-full mx-auto bg-background border border-border rounded-lg overflow-hidden',
        aspectRatioClass,
        className
      )}
      style={{ maxWidth }}
    >
      <div className="w-full h-full flex flex-col">
        {children}
      </div>
    </div>
  );
};

interface FrameHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
}

export const FrameHeader: React.FC<FrameHeaderProps> = ({ title, subtitle, icon }) => {
  return (
    <div className="flex items-center gap-3 p-4 border-b border-border bg-card/50">
      {icon && (
        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-bold text-foreground truncate">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
        )}
      </div>
    </div>
  );
};

interface FrameContentProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
}

export const FrameContent: React.FC<FrameContentProps> = ({
  children,
  className,
  padding = true,
}) => {
  return (
    <div
      className={cn(
        'flex-1 flex flex-col overflow-hidden',
        padding && 'p-4',
        className
      )}
    >
      {children}
    </div>
  );
};

interface FrameActionsProps {
  children: React.ReactNode;
  className?: string;
}

export const FrameActions: React.FC<FrameActionsProps> = ({ children, className }) => {
  return (
    <div
      className={cn(
        'flex gap-2 p-4 border-t border-border bg-card/30',
        className
      )}
    >
      {children}
    </div>
  );
};

interface FrameButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  disabled?: boolean;
  className?: string;
  fullWidth?: boolean;
}

export const FrameButton: React.FC<FrameButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  className,
  fullWidth = false,
}) => {
  const baseClasses = 'px-4 py-2 rounded-lg font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variantClasses = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-primary',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 focus:ring-secondary',
    outline: 'border border-border text-foreground hover:bg-accent focus:ring-accent',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        baseClasses,
        variantClasses[variant],
        fullWidth && 'flex-1',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {children}
    </button>
  );
};

interface FrameImageProps {
  src: string;
  alt: string;
  className?: string;
}

export const FrameImage: React.FC<FrameImageProps> = ({ src, alt, className }) => {
  return (
    <div className={cn('relative w-full h-48 bg-muted rounded-lg overflow-hidden', className)}>
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
        loading="lazy"
      />
    </div>
  );
};

interface FrameInputProps {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  maxLength?: number;
}

export const FrameInput: React.FC<FrameInputProps> = ({
  placeholder,
  value,
  onChange,
  className,
  maxLength = 100,
}) => {
  return (
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      maxLength={maxLength}
      className={cn(
        'w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
        className
      )}
    />
  );
};

interface FrameStatusProps {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  className?: string;
}

export const FrameStatus: React.FC<FrameStatusProps> = ({ type, message, className }) => {
  const typeClasses = {
    success: 'bg-green-50 text-green-800 border-green-200',
    error: 'bg-red-50 text-red-800 border-red-200',
    warning: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    info: 'bg-blue-50 text-blue-800 border-blue-200',
  };

  return (
    <div
      className={cn(
        'px-3 py-2 rounded-lg border text-sm font-medium',
        typeClasses[type],
        className
      )}
    >
      {message}
    </div>
  );
};
