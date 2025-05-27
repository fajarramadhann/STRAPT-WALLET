import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Shield, BarChart2, Users, MessageCircle, CheckCircle, Zap, Smartphone, Droplets, Wallet, Loader2 } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useXellarWallet } from '@/hooks/use-xellar-wallet';

const Index = () => {
  const { isConnected } = useAccount();
  const { connectWallet } = useXellarWallet();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  // Redirect to app if already connected
  useEffect(() => {
    if (isConnected) {
      navigate('/app');
    }
  }, [isConnected, navigate]);

  const handleLaunchApp = async () => {
    console.log('Launch App clicked, isConnected:', isConnected);
    if (isConnected) {
      console.log('Already connected, navigating to /app');
      navigate('/app');
    } else {
      console.log('Not connected, attempting to connect wallet');
      setIsLoading(true);
      try {
        // Open Xellar wallet connection modal
        console.log('Calling connectWallet()');
        await connectWallet();
        console.log('connectWallet() completed');
        // The useEffect will handle navigation after successful connection
      } catch (error) {
        console.error("Error connecting wallet:", error);
        // You might want to show a toast or error message to the user here
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">

      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold gradient-text">STRAPT</h1>
            <div className="hidden md:flex items-center space-x-6">
              <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</a>
              <a href="#why" className="text-muted-foreground hover:text-foreground transition-colors">Why STRAPT</a>
              <a href="#showcase" className="text-muted-foreground hover:text-foreground transition-colors">Showcase</a>
            </div>
            <Button
              onClick={handleLaunchApp}
              className="md:hidden"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Launch App"
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-10 pb-20 px-4">
      <div className="max-w-7xl mx-auto">
          <div className="md:flex md:items-center md:space-x-12">
            <div className="text-center md:text-left md:w-1/2 mb-8 md:mb-0">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 gradient-text">
                Send It, Stream It, STRAPT It.
              </h1>
              <p className="text-lg text-muted-foreground mb-8 max-w-2xl">
                The fastest way to move crypto — no addresses, no stress. Powered by IDRX.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start mb-8">
                <Button
                  onClick={handleLaunchApp}
                  className="w-full sm:w-auto text-base font-medium"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      Launch App <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Phone Mockup */}
            <div className="mx-auto max-w-xs md:max-w-sm md:w-1/2">
              <div className="relative">
                <div className="rounded-[3rem] bg-card p-4 overflow-hidden border-8 border-foreground/10 shadow-xl">
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-1/3 h-6 bg-foreground/10 rounded-b-xl z-10" />
                  <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20 aspect-[9/19]">
                    <img
                      src="/home-mobile.png"
                      alt="STRAPT Home Dashboard"
                      className="w-full h-auto"
                    />
                  </div>
                </div>
                <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-gradient-to-br from-primary to-accent rounded-full blur-xl opacity-30" />
              </div>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="max-w-7xl mx-auto mt-24" id="features">
          <h2 className="text-2xl md:text-3xl font-bold mb-6 text-center gradient-text">Features</h2>
          <p className="text-center text-muted-foreground max-w-2xl mx-auto mb-10">
            STRAPT offers a comprehensive suite of financial tools designed for the modern crypto user.
          </p>
          <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-6">
            <div className="flex flex-col items-start p-6 rounded-2xl bg-card border border-primary/10 hover:border-primary/30 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 h-full">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-base mb-2">Protected Transfers</h3>
              <p className="text-sm text-muted-foreground">Send crypto with passwords or QR links — no need to drop addresses ever again. Perfect for secure person-to-person payments.</p>
            </div>
            <div className="flex flex-col items-start p-6 rounded-2xl bg-card border border-primary/10 hover:border-primary/30 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 h-full">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <BarChart2 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-base mb-2">Streaming Payments</h3>
              <p className="text-sm text-muted-foreground">Automate salaries, subscriptions, and project payouts, right from your wallet. Set it up once and let the funds flow continuously.</p>
            </div>
            <div className="flex flex-col items-start p-6 rounded-2xl bg-card border border-primary/10 hover:border-primary/30 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 h-full">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-base mb-2">Group Pools</h3>
              <p className="text-sm text-muted-foreground">Easily collect, split, or manage pooled funds with friends or teams. Perfect for group expenses, projects, or community treasuries.</p>
            </div>
            <div className="flex flex-col items-start p-6 rounded-2xl bg-card border border-primary/10 hover:border-primary/30 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 h-full">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-base mb-2">Crypto Savings</h3>
              <p className="text-sm text-muted-foreground">Set targets, earn while you wait. Your DeFi piggy bank, simplified. Create savings goals and watch your assets grow over time.</p>
            </div>
            <div className="flex flex-col items-start p-6 rounded-2xl bg-card border border-primary/10 hover:border-primary/30 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 h-full">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Droplets className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-base mb-2">Token Faucet</h3>
              <p className="text-sm text-muted-foreground">No IDRX? No problem. Grab free tokens and start exploring instantly. Our faucet provides the tokens you need to test all features.</p>
            </div>
            <div className="flex flex-col items-start p-6 rounded-2xl bg-card border border-primary/10 hover:border-primary/30 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 h-full">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <MessageCircle className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-base mb-2">Mini App</h3>
              <p className="text-sm text-muted-foreground">Coming soon: Send and receive payments directly from your Telegram chats. Seamless integration with your favorite messaging platform.</p>
            </div>
          </div>
        </div>

        {/* Why STRAPT Section */}
        <div className="max-w-7xl mx-auto mt-24" id="why">
          <h2 className="text-2xl md:text-3xl font-bold mb-10 text-center gradient-text">Why STRAPT?</h2>
          <div className="md:grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="flex items-start p-6 rounded-2xl bg-card border border-primary/10 hover:border-primary/30 hover:shadow-lg transition-all duration-300 mb-4 md:mb-0">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mr-4 flex-shrink-0">
                <CheckCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-2">No scams, no stress</h3>
                <p className="text-sm text-muted-foreground">Built-in protections ensure your crypto arrives safely to its destination.</p>
              </div>
            </div>
            <div className="flex items-start p-6 rounded-2xl bg-card border border-primary/10 hover:border-primary/30 hover:shadow-lg transition-all duration-300 mb-4 md:mb-0">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mr-4 flex-shrink-0">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-2">Easy as Venmo, secure as blockchain</h3>
                <p className="text-sm text-muted-foreground">Familiar payment experience, but with the security of Web3.</p>
              </div>
            </div>
            <div className="flex items-start p-6 rounded-2xl bg-card border border-primary/10 hover:border-primary/30 hover:shadow-lg transition-all duration-300 mb-4 md:mb-0">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mr-4 flex-shrink-0">
                <Smartphone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-2">Mobile-first & responsive design</h3>
                <p className="text-sm text-muted-foreground">Optimized for smartphones and desktops with intuitive flows.</p>
              </div>
            </div>
          </div>
        </div>

        {/* App Showcase Section */}
        <div className="max-w-7xl mx-auto mt-24 px-4" id="showcase">
          <div className="mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-6 text-center gradient-text">Experience STRAPT</h2>
            <p className="text-center text-muted-foreground max-w-2xl mx-auto">
              Explore our intuitive interface designed for seamless crypto transactions
            </p>
          </div>

          <div className="flex flex-col items-center justify-center">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 lg:gap-12 max-w-6xl mx-auto">
              {/* Phone Mockup 1 - Transfer */}
              <div className="flex flex-col items-center">
                <div className="mb-4 text-center">
                  <h3 className="font-medium text-primary">Protected Transfers</h3>
                </div>

                <div className="relative mx-auto hover:-translate-y-2 transition-transform duration-300">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-accent/30 rounded-[2.5rem] blur-xl opacity-30 transform -rotate-6" />
                  <div className="relative rounded-[2.5rem] border-8 border-foreground/10 shadow-xl overflow-hidden bg-card">
                    <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-1/3 h-6 bg-foreground/10 rounded-b-xl z-10" />
                    <img
                      src="/transfer-mobile.png"
                      alt="STRAPT Transfer Interface"
                      className="w-full h-auto"
                    />
                  </div>
                </div>
              </div>

              {/* Phone Mockup 2 - Home */}
              <div className="flex flex-col items-center">
                <div className="mb-4 text-center">
                  <h3 className="font-medium text-primary">Home Dashboard</h3>
                </div>

                <div className="relative mx-auto hover:-translate-y-2 transition-transform duration-300">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-accent/30 rounded-[2.5rem] blur-xl opacity-30 transform rotate-3" />
                  <div className="relative rounded-[2.5rem] border-8 border-foreground/10 shadow-xl overflow-hidden bg-card">
                    <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-1/3 h-6 bg-foreground/10 rounded-b-xl z-10" />
                    <img
                      src="/home-mobile.png"
                      alt="STRAPT Home Dashboard"
                      className="w-full h-auto"
                    />
                  </div>
                </div>
              </div>

              {/* Phone Mockup 3 - STRAPT Drop (moved to center) */}
              <div className="flex flex-col items-center">
                <div className="mb-4 text-center">
                  <div className="flex items-center justify-center">
                    <h3 className="font-bold text-lg text-primary">STRAPT Drop</h3>
                    <div className="ml-2 bg-gradient-to-r from-primary to-accent text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      Featured
                    </div>
                  </div>
                </div>

                <div className="relative mx-auto hover:-translate-y-2 transition-transform duration-300">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/40 to-accent/40 rounded-[2.5rem] blur-xl opacity-40" />
                  <div className="relative rounded-[2.5rem] border-8 border-foreground/10 shadow-xl overflow-hidden bg-card">
                    <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-1/3 h-6 bg-foreground/10 rounded-b-xl z-10" />
                    <img
                      src="/drop-mobile.png"
                      alt="STRAPT Drop Interface"
                      className="w-full h-auto"
                    />
                  </div>
                </div>
              </div>

              {/* Phone Mockup 4 - Streams */}
              <div className="flex flex-col items-center">
                <div className="mb-4 text-center">
                  <h3 className="font-medium text-accent">Payment Streams</h3>
                </div>

                <div className="relative mx-auto hover:-translate-y-2 transition-transform duration-300">
                  <div className="absolute inset-0 bg-gradient-to-br from-accent/30 to-primary/30 rounded-[2.5rem] blur-xl opacity-30 transform rotate-6" />
                  <div className="relative rounded-[2.5rem] border-8 border-foreground/10 shadow-xl overflow-hidden bg-card">
                    <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-1/3 h-6 bg-foreground/10 rounded-b-xl z-10" />
                    <img
                      src="/payment-streams-mobile.png"
                      alt="STRAPT Payment Streams Interface"
                      className="w-full h-auto"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="max-w-4xl mx-auto mt-24 text-center">
          <div className="bg-gradient-to-r from-primary/20 to-accent/20 rounded-2xl p-8 md:p-12 border border-primary/10 shadow-lg">
            <h2 className="text-2xl md:text-3xl font-bold mb-4 gradient-text">Ready to get started?</h2>
            <p className="text-lg mb-8 max-w-2xl mx-auto text-muted-foreground">
              Thousands already STRAPT their crypto — it's time to send smarter.
            </p>
            <Button
              onClick={handleLaunchApp}
              className="w-full sm:w-auto text-base font-medium"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  Launch App <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Footer */}
        <footer className="max-w-7xl mx-auto mt-24 pt-8 border-t border-border">
          <div className="md:flex md:justify-between">
            <div className="mb-6 md:mb-0">
              <h1 className="text-xl font-bold gradient-text mb-4">STRAPT</h1>
              <p className="text-sm text-muted-foreground max-w-xs">
                Secure crypto payments, simplified for Web3 users.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
              <div>
                <h2 className="mb-4 text-sm font-semibold uppercase">Resources</h2>
                <ul className="text-sm space-y-2">
                  <li><a href="#" className="text-muted-foreground hover:text-foreground">Docs</a></li>
                  <li><a href="#" className="text-muted-foreground hover:text-foreground">GitHub</a></li>
                  <li><a href="#" className="text-muted-foreground hover:text-foreground">Blog</a></li>
                </ul>
              </div>
              <div>
                <h2 className="mb-4 text-sm font-semibold uppercase">Legal</h2>
                <ul className="text-sm space-y-2">
                  <li><a href="#" className="text-muted-foreground hover:text-foreground">Privacy Policy</a></li>
                  <li><a href="#" className="text-muted-foreground hover:text-foreground">Terms of Service</a></li>
                  <li><a href="#" className="text-muted-foreground hover:text-foreground">Cookies</a></li>
                </ul>
              </div>
              <div>
                <h2 className="mb-4 text-sm font-semibold uppercase">Contact</h2>
                <ul className="text-sm space-y-2">
                  <li><a href="#" className="text-muted-foreground hover:text-foreground">Contact Us</a></li>
                  <li><a href="#" className="text-muted-foreground hover:text-foreground">Support</a></li>
                  <li><a href="#" className="text-muted-foreground hover:text-foreground">Twitter</a></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-8 pt-8 border-t border-border">
            <p className="text-xs text-muted-foreground mb-4 sm:mb-0">
              &copy; {new Date().getFullYear()} STRAPT. All rights reserved.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="p-2 rounded-full bg-secondary hover:bg-secondary/70 transition-colors">
                <MessageCircle className="h-5 w-5" />
              </a>
              <a href="#" className="p-2 rounded-full bg-secondary hover:bg-secondary/70 transition-colors">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.675 0H1.325C0.593 0 0 0.593 0 1.325V22.676C0 23.407 0.593 24 1.325 24H12.82V14.706H9.692V11.084H12.82V8.413C12.82 5.313 14.713 3.625 17.479 3.625C18.804 3.625 19.942 3.724 20.274 3.768V7.008H18.356C16.852 7.008 16.561 7.724 16.561 8.772V11.085H20.148L19.681 14.707H16.561V24H22.677C23.407 24 24 23.407 24 22.675V1.325C24 0.593 23.407 0 22.675 0Z" fill="currentColor"/>
                </svg>
              </a>
              <a href="#" className="p-2 rounded-full bg-secondary hover:bg-secondary/70 transition-colors">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M23.643 4.937C22.808 5.307 21.911 5.557 20.968 5.67C21.941 5.08 22.669 4.17 23.016 3.092C22.116 3.626 21.119 4.01 20.058 4.222C19.208 3.319 17.998 2.75 16.658 2.75C14.086 2.75 12 4.836 12 7.407C12 7.766 12.042 8.115 12.12 8.45C8.247 8.261 4.81 6.416 2.518 3.639C2.118 4.323 1.891 5.08 1.891 5.887C1.891 7.409 2.664 8.744 3.868 9.498C3.106 9.474 2.389 9.267 1.758 8.921C1.758 8.941 1.758 8.962 1.758 8.983C1.758 11.255 3.352 13.152 5.465 13.574C5.075 13.681 4.665 13.738 4.242 13.738C3.939 13.738 3.644 13.709 3.357 13.654C3.956 15.517 5.692 16.873 7.742 16.91C6.129 18.175 4.097 18.922 1.89 18.922C1.515 18.922 1.143 18.9 0.779 18.855C2.85 20.196 5.303 20.969 7.958 20.969C16.647 20.969 21.389 13.815 21.389 7.619C21.389 7.419 21.385 7.22 21.376 7.023C22.286 6.35 23.073 5.513 23.641 4.542L23.643 4.937Z" fill="currentColor"/>
                </svg>
              </a>
            </div>
          </div>
        </footer>
      </section>
    </div>
  );
};

export default Index;
