import { useState, useEffect, useRef } from 'react';
import { Check, Loader2, User, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'framer-motion';
import { useConfetti } from '@/hooks/use-confetti';

interface UsernameRegistrationProps {
  onComplete: () => void;
}

const EnhancedUsernameRegistration = ({ onComplete }: UsernameRegistrationProps) => {
  const [username, setUsername] = useState('');
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [step, setStep] = useState(1);
  const [progress, setProgress] = useState(0);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { triggerCelebrationConfetti } = useConfetti();

  // Focus input on mount
  useEffect(() => {
    if (step === 1 && inputRef.current) {
      inputRef.current.focus();
    }
  }, [step]);

  // Mock function to check username availability
  const checkUsernameAvailability = async (username: string) => {
    setChecking(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    const isAvailable = username.length >= 3 && !['admin', 'system', 'truststream'].includes(username.toLowerCase());
    setChecking(false);
    setAvailable(isAvailable);
    return isAvailable;
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.trim().toLowerCase();
    setUsername(value);
    setAvailable(null);

    // Debounce the availability check
    if (value.length >= 3) {
      const timer = setTimeout(() => {
        checkUsernameAvailability(value);
      }, 500);
      return () => clearTimeout(timer);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || username.length < 3) {
      toast({
        title: "Invalid Username",
        description: "Username must be at least 3 characters",
        variant: "destructive",
      });
      return;
    }

    setChecking(true);
    const isAvailable = await checkUsernameAvailability(username);

    if (isAvailable) {
      // Move directly to completion step
      setChecking(false);
      nextStep();
    } else {
      toast({
        title: "Username Unavailable",
        description: "Please choose another username",
        variant: "destructive",
      });
      setChecking(false);
    }
  };

  const nextStep = () => {
    setProgress(100);
    setStep(2);

    // Show success animation after a short delay
    setTimeout(() => {
      setShowSuccessAnimation(true);
      triggerCelebrationConfetti();
    }, 300);
  };

  const handleComplete = () => {
    toast({
      title: "Registration Complete",
      description: `@${username}.strapt is now yours!`,
    });
    onComplete();
  };



  return (
    <Card className="border-primary/20 shadow-lg overflow-hidden">
      <CardHeader className="relative pb-2">
        <CardTitle className="text-xl flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          {step === 1 ? "Choose Your Username" : "Registration Complete"}
        </CardTitle>
        <CardDescription>
          {step === 1 ? "Create your unique identity on STRAPT" : "Your on-chain identity is ready"}
        </CardDescription>
        <Progress value={progress} className="h-1 mt-4 bg-primary/10" />
      </CardHeader>

      <CardContent className="pt-4">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <div className="relative">
                    <Input
                      ref={inputRef}
                      placeholder="username"
                      value={username}
                      onChange={handleUsernameChange}
                      className="pr-20 h-12 text-base border-primary/20 focus:border-primary"
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm font-medium text-primary">
                      .strapt
                    </div>
                  </div>

                  <AnimatePresence>
                    {username && username.length >= 3 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center text-sm mt-2"
                      >
                        {checking ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            <span className="text-muted-foreground">Checking availability...</span>
                          </>
                        ) : available === true ? (
                          <>
                            <Check className="h-3 w-3 text-green-500 mr-1" />
                            <span className="text-green-500">Username available!</span>
                          </>
                        ) : available === false ? (
                          <>
                            <X className="h-3 w-3 text-destructive mr-1" />
                            <span className="text-destructive">Username unavailable</span>
                          </>
                        ) : null}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <p className="text-xs text-muted-foreground mt-1">
                    Choose a username for your wallet. This will be your public identity on STRAPT.
                  </p>
                </div>

                <div className="space-y-1 bg-secondary/30 p-3 rounded-md">
                  <p className="text-sm font-medium">Username Requirements:</p>
                  <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-1">
                    <li className={username.length >= 3 ? "text-green-500" : ""}>
                      At least 3 characters
                    </li>
                    <li className={/^[a-z0-9_]+$/.test(username) ? "text-green-500" : ""}>
                      Only lowercase letters, numbers and underscores
                    </li>
                    <li>Cannot be changed later</li>
                  </ul>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 text-base"
                  disabled={checking || !username || username.length < 3 || available === false}
                >
                  {checking ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Checking
                    </>
                  ) : (
                    <>
                      Continue <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.2, 1] }}
                  transition={{ duration: 0.5, times: [0, 0.7, 1] }}
                  className="mx-auto"
                >
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent rounded-full animate-pulse blur-md opacity-50" />
                    <Avatar className="h-24 w-24 mx-auto border-4 border-primary relative">
                      <AvatarFallback className="text-2xl bg-gradient-to-br from-primary/80 to-accent/80 text-white font-bold">
                        {username[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </motion.div>

                <motion.h3
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-xl font-medium mt-4"
                >
                  @{username}.strapt
                </motion.h3>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-sm text-muted-foreground mt-2"
                >
                  Your username is now registered and ready to use
                </motion.p>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="space-y-1 bg-secondary/30 p-4 rounded-md"
              >
                <p className="text-sm font-medium">What happens next:</p>
                <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-2">
                  <li>Your username will be linked to your current wallet address</li>
                  <li>You can use this username to send and receive payments</li>
                  <li>Others can find you using @{username}.strapt</li>
                </ul>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>

      {step === 2 && (
        <CardFooter className="pt-2 pb-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="w-full"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button
              className="w-full h-12 text-base bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all"
              onClick={handleComplete}
            >
              Start Using STRAPT
            </Button>
          </motion.div>
        </CardFooter>
      )}

      {/* Success Animation Overlay */}
      <AnimatePresence>
        {showSuccessAnimation && (
          <motion.div
            className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-card rounded-xl p-8 flex flex-col items-center max-w-md mx-4"
              initial={{ scale: 0.8, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.8, y: 20, opacity: 0 }}
              transition={{ type: "spring", damping: 15 }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.2, 1] }}
                transition={{ duration: 0.5, times: [0, 0.7, 1] }}
              >
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-green-500 flex items-center justify-center mb-4 animate-pulse shadow-lg">
                  <Check className="h-10 w-10 text-white" />
                </div>
              </motion.div>
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-xl font-bold mb-2"
              >
                Username Registered!
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-center text-muted-foreground mb-6"
              >
                @{username}.strapt is now yours
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <Button
                  onClick={() => setShowSuccessAnimation(false)}
                  className="px-8 bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all"
                >
                  Continue
                </Button>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
};

export default EnhancedUsernameRegistration;
