import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocation } from 'react-router-dom';
import XellarWalletProfile from './XellarWalletProfile';
import { ThemeToggleSimple } from '@/components/ui/theme-toggle';

const Header = () => {
  const location = useLocation();
  const path = location.pathname.split('/')[2] || 'home';

  const getTitle = () => {
    switch (path) {
      case '':
        return 'Home';
      default:
        return path.charAt(0).toUpperCase() + path.slice(1);
    }
  };

  return (
    <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm p-4 border-b border-border">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold gradient-text">{getTitle()}</h1>
        <div className="flex items-center gap-2">
          <ThemeToggleSimple />
          <Button variant="ghost" size="icon" className="rounded-full">
            <Bell className="h-5 w-5" />
          </Button>
          <XellarWalletProfile />
        </div>
      </div>
    </header>
  );
};

export default Header;
