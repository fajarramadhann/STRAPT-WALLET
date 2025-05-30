import { toast as sonnerToast } from 'sonner';

// Store for tracking recent toasts to prevent duplicates
const recentToasts = new Map<string, number>();
const TOAST_COOLDOWN = 3000; // 3 seconds cooldown for duplicate toasts

// Generate a unique key for a toast based on its content
function generateToastKey(type: string, title: string, description?: string): string {
  return `${type}:${title}:${description || ''}`;
}

// Clean up old toast entries
function cleanupOldToasts(): void {
  const now = Date.now();
  for (const [key, timestamp] of recentToasts.entries()) {
    if (now - timestamp > TOAST_COOLDOWN) {
      recentToasts.delete(key);
    }
  }
}

// Check if a toast should be shown (not a duplicate)
function shouldShowToast(key: string): boolean {
  cleanupOldToasts();
  const lastShown = recentToasts.get(key);
  const now = Date.now();
  
  if (!lastShown || now - lastShown > TOAST_COOLDOWN) {
    recentToasts.set(key, now);
    return true;
  }
  
  return false;
}

// Enhanced toast functions with deduplication
export const toast = {
  success: (title: string, options?: { description?: string; action?: any }) => {
    const key = generateToastKey('success', title, options?.description);
    if (shouldShowToast(key)) {
      return sonnerToast.success(title, options);
    }
  },
  
  error: (title: string, options?: { description?: string; action?: any }) => {
    const key = generateToastKey('error', title, options?.description);
    if (shouldShowToast(key)) {
      return sonnerToast.error(title, options);
    }
  },
  
  info: (title: string, options?: { description?: string; action?: any }) => {
    const key = generateToastKey('info', title, options?.description);
    if (shouldShowToast(key)) {
      return sonnerToast.info(title, options);
    }
  },
  
  warning: (title: string, options?: { description?: string; action?: any }) => {
    const key = generateToastKey('warning', title, options?.description);
    if (shouldShowToast(key)) {
      return sonnerToast.warning(title, options);
    }
  },
  
  // Default toast function
  default: (title: string, options?: { description?: string; action?: any }) => {
    const key = generateToastKey('default', title, options?.description);
    if (shouldShowToast(key)) {
      return sonnerToast(title, options);
    }
  },
  
  // Force show toast (bypass deduplication)
  force: {
    success: (title: string, options?: { description?: string; action?: any }) => {
      return sonnerToast.success(title, options);
    },
    error: (title: string, options?: { description?: string; action?: any }) => {
      return sonnerToast.error(title, options);
    },
    info: (title: string, options?: { description?: string; action?: any }) => {
      return sonnerToast.info(title, options);
    },
    warning: (title: string, options?: { description?: string; action?: any }) => {
      return sonnerToast.warning(title, options);
    },
    default: (title: string, options?: { description?: string; action?: any }) => {
      return sonnerToast(title, options);
    }
  },
  
  // Dismiss all toasts
  dismiss: (toastId?: string | number) => {
    return sonnerToast.dismiss(toastId);
  },
  
  // Promise toast (useful for async operations)
  promise: <T>(
    promise: Promise<T>,
    options: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: any) => string);
    }
  ) => {
    return sonnerToast.promise(promise, options);
  }
};

// Export the enhanced toast as default
export default toast;
