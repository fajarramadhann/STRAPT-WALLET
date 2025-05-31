import { useCallback } from 'react';
import confetti from 'canvas-confetti';

interface ConfettiOptions {
  duration?: number;
  particleCount?: number;
  spread?: number;
  startVelocity?: number;
  colors?: string[];
  zIndex?: number;
}

export const useConfetti = () => {
  const triggerConfetti = useCallback((options: ConfettiOptions = {}) => {
    const {
      duration = 3000,
      particleCount = 50,
      spread = 360,
      startVelocity = 30,
      colors = ['#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#3B82F6'],
      zIndex = 1000
    } = options;

    const animationEnd = Date.now() + duration;
    const defaults = { 
      startVelocity, 
      spread, 
      ticks: 60, 
      zIndex,
      colors
    };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const currentParticleCount = particleCount * (timeLeft / duration);

      // Create confetti from multiple origins for better effect
      confetti({
        ...defaults,
        particleCount: currentParticleCount,
        origin: { x: randomInRange(0.1, 0.3), y: randomInRange(0, 0.2) }
      });
      confetti({
        ...defaults,
        particleCount: currentParticleCount,
        origin: { x: randomInRange(0.7, 0.9), y: randomInRange(0, 0.2) }
      });
    }, 250);

    return () => clearInterval(interval);
  }, []);

  const triggerSuccessConfetti = useCallback(() => {
    return triggerConfetti({
      duration: 3000,
      particleCount: 60,
      colors: ['#10B981', '#34D399', '#6EE7B7', '#A7F3D0']
    });
  }, [triggerConfetti]);

  const triggerClaimConfetti = useCallback(() => {
    return triggerConfetti({
      duration: 4000,
      particleCount: 80,
      colors: ['#8B5CF6', '#A78BFA', '#C4B5FD', '#DDD6FE', '#10B981']
    });
  }, [triggerConfetti]);

  const triggerCelebrationConfetti = useCallback(() => {
    return triggerConfetti({
      duration: 5000,
      particleCount: 100,
      spread: 400,
      startVelocity: 45,
      colors: ['#F59E0B', '#FBBF24', '#FCD34D', '#FDE68A', '#8B5CF6', '#A78BFA']
    });
  }, [triggerConfetti]);

  return {
    triggerConfetti,
    triggerSuccessConfetti,
    triggerClaimConfetti,
    triggerCelebrationConfetti
  };
};
