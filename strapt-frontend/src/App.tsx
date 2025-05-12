
import { Toaster as Sonner } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { ThemeProvider } from "@/components/ui/theme-provider";

import { XellarProvider } from './providers/XellarProvider';

import Index from "./pages/Index";
import Home from "./pages/Home";
import Transfer from "./pages/Transfer";
import Streams from "./pages/Streams";
import Pools from "./pages/Pools";
import StraptDrop from "./pages/StraptDrop";
import StraptDropClaim from "./pages/StraptDropClaim";
import MyDrops from "./pages/MyDrops";
import Profile from "./pages/Profile";
import Claims from "./pages/Claims";
import Savings from "./pages/Savings";
import ComingSoon from "./pages/ComingSoon";
import NotFound from "./pages/NotFound";
import Layout from "./components/Layout";
import DesktopLayout from "./components/DesktopLayout";
import WalletCheck from './components/WalletCheck';

const App = () => {
  const isMobile = useIsMobile();

  return (
    <ThemeProvider defaultTheme="dark" storageKey="strapt-theme">
      <XellarProvider>
        <TooltipProvider>
          <Sonner position="top-right" />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="claim/:id?" element={<Navigate to="/app/claims" replace />} />
              {/* Protected routes require wallet connection */}
              <Route element={<WalletCheck />}>
                <Route path="app" element={isMobile ? <Layout /> : <DesktopLayout />}>
                  <Route index element={<Home />} />
                  <Route path="transfer" element={<Transfer />} />
                  <Route path="streams" element={<Streams />} />
                  <Route path="savings" element={<Savings />} />
                  <Route path="pools" element={<Pools />} />
                  <Route path="strapt-drop" element={<StraptDrop />} />
                  <Route path="strapt-drop/claim" element={<StraptDropClaim />} />
                  <Route path="strapt-drop/my-drops" element={<MyDrops />} />
                  <Route path="profile" element={<Profile />} />
                  <Route path="claims" element={<Claims />} />
                  <Route path="coming-soon" element={<ComingSoon />} />
                </Route>
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </XellarProvider>
    </ThemeProvider>
  );
};

export default App;
