import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { FarcasterProvider } from '@/contexts/FarcasterContext';
import TransferFramePage from '@/pages/frames/TransferFramePage';
import StraptDropFramePage from '@/pages/frames/StraptDropFramePage';

/**
 * Router component for Farcaster frames
 * Handles frame-specific routing and provides Farcaster context
 */
export const FrameRouter: React.FC = () => {
  return (
    <FarcasterProvider>
      <Routes>
        {/* Transfer frame routes */}
        <Route path="/frames/transfer" element={<TransferFramePage />} />
        
        {/* STRAPT Drop frame routes */}
        <Route path="/frames/drop" element={<StraptDropFramePage />} />
        <Route path="/frames/drop/:dropId" element={<StraptDropFramePage />} />
        
        {/* Legacy frame routes for compatibility */}
        <Route path="/frame/transfer" element={<TransferFramePage />} />
        <Route path="/frame/drop" element={<StraptDropFramePage />} />
        <Route path="/frame/drop/:dropId" element={<StraptDropFramePage />} />
        
        {/* Default frame route - redirect to main app */}
        <Route path="/frames" element={<FrameIndex />} />
        <Route path="/frame" element={<FrameIndex />} />
      </Routes>
    </FarcasterProvider>
  );
};

/**
 * Index page for frames - shows available frame options
 */
const FrameIndex: React.FC = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold gradient-text">STRAPT</h1>
          <p className="text-muted-foreground">
            Secure transfers and drops on Farcaster
          </p>
        </div>

        <div className="space-y-3">
          <FrameOption
            title="Send Transfer"
            description="Send secure transfers with password protection"
            href="/frames/transfer"
            icon="💸"
          />
          
          <FrameOption
            title="Create Drop"
            description="Distribute tokens to multiple recipients"
            href="/frames/drop?mode=create"
            icon="🎁"
          />
          
          <FrameOption
            title="Open App"
            description="Access the full STRAPT application"
            href="/app"
            icon="🚀"
          />
        </div>

        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            Powered by STRAPT Protocol on Lisk Sepolia
          </p>
        </div>
      </div>
    </div>
  );
};

interface FrameOptionProps {
  title: string;
  description: string;
  href: string;
  icon: string;
}

const FrameOption: React.FC<FrameOptionProps> = ({ title, description, href, icon }) => {
  return (
    <a
      href={href}
      className="block p-4 bg-card border border-border rounded-lg hover:bg-accent transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="text-2xl">{icon}</div>
        <div className="flex-1">
          <h3 className="font-medium text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="text-muted-foreground">→</div>
      </div>
    </a>
  );
};

export default FrameRouter;
