import { useCallback } from 'react';
import { toast } from 'sonner';

/**
 * Custom hook for toast notifications with consistent styling and behavior
 */
export function useToast() {
  /**
   * Show a success toast
   * @param title The toast title
   * @param description Optional description
   * @param duration Optional duration in milliseconds
   */
  const success = useCallback((
    title: string,
    description?: string,
    duration?: number
  ) => {
    toast.success(title, {
      description,
      duration: duration || 5000,
    });
  }, []);

  /**
   * Show an error toast
   * @param title The toast title
   * @param description Optional description
   * @param duration Optional duration in milliseconds
   */
  const error = useCallback((
    title: string,
    description?: string,
    duration?: number
  ) => {
    toast.error(title, {
      description,
      duration: duration || 7000,
    });
  }, []);

  /**
   * Show an info toast
   * @param title The toast title
   * @param description Optional description
   * @param duration Optional duration in milliseconds
   */
  const info = useCallback((
    title: string,
    description?: string,
    duration?: number
  ) => {
    toast.info(title, {
      description,
      duration: duration || 5000,
    });
  }, []);

  /**
   * Show a warning toast
   * @param title The toast title
   * @param description Optional description
   * @param duration Optional duration in milliseconds
   */
  const warning = useCallback((
    title: string,
    description?: string,
    duration?: number
  ) => {
    toast.warning(title, {
      description,
      duration: duration || 6000,
    });
  }, []);

  /**
   * Show a loading toast
   * @param title The toast title
   * @param description Optional description
   * @returns A promise and a dismiss function
   */
  const loading = useCallback((
    title: string,
    description?: string
  ) => {
    const toastId = toast.loading(title, {
      description,
    });
    
    return {
      dismiss: () => toast.dismiss(toastId),
      update: (newTitle: string, newDescription?: string) => {
        toast.loading(newTitle, {
          id: toastId,
          description: newDescription,
        });
      },
      success: (newTitle: string, newDescription?: string) => {
        toast.success(newTitle, {
          id: toastId,
          description: newDescription,
        });
      },
      error: (newTitle: string, newDescription?: string) => {
        toast.error(newTitle, {
          id: toastId,
          description: newDescription,
        });
      },
    };
  }, []);

  /**
   * Show a transaction toast
   * @param hash The transaction hash
   * @param message Optional message
   * @returns A promise that resolves when the transaction is confirmed
   */
  const transaction = useCallback((
    hash: `0x${string}`,
    message?: string
  ) => {
    const toastId = toast.loading(message || 'Transaction submitted', {
      description: 'Waiting for confirmation...',
    });
    
    return {
      dismiss: () => toast.dismiss(toastId),
      update: (newTitle: string, newDescription?: string) => {
        toast.loading(newTitle, {
          id: toastId,
          description: newDescription,
        });
      },
      success: (newTitle: string, newDescription?: string) => {
        toast.success(newTitle, {
          id: toastId,
          description: newDescription,
        });
      },
      error: (newTitle: string, newDescription?: string) => {
        toast.error(newTitle, {
          id: toastId,
          description: newDescription,
        });
      },
    };
  }, []);

  /**
   * Handle an error and show an appropriate toast
   * @param error The error object
   * @param fallbackMessage Optional fallback message
   */
  const handleError = useCallback((
    error: unknown,
    fallbackMessage: string = 'An error occurred'
  ) => {
    console.error('Error:', error);
    
    if (error instanceof Error) {
      // Handle user rejected transaction
      if (error.message.includes('user rejected') || error.message.includes('User denied')) {
        toast.error('Transaction rejected', {
          description: 'You rejected the transaction',
        });
        return;
      }
      
      // Handle insufficient funds
      if (error.message.includes('insufficient funds')) {
        toast.error('Insufficient funds', {
          description: 'You do not have enough funds to complete this transaction',
        });
        return;
      }
      
      // Handle RPC errors
      if (error.message.includes('RPC') || error.message.includes('network')) {
        toast.error('Network error', {
          description: 'There was an issue connecting to the blockchain. Please try again later.',
        });
        return;
      }
      
      // Handle other errors
      toast.error(fallbackMessage, {
        description: error.message,
      });
    } else {
      // Handle unknown errors
      toast.error(fallbackMessage);
    }
  }, []);

  return {
    success,
    error,
    info,
    warning,
    loading,
    transaction,
    handleError,
  };
}

export default useToast;
