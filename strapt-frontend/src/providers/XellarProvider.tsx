import React from "react";
import { Config, WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { XellarKitProvider, defaultConfig, darkTheme } from "@xellar/kit";
import { liskSepolia, baseSepolia } from "viem/chains";

const walletConnectProjectId = "0a6602a98f8e6ca23405a5c8cd8805e8";
const xellarAppId = "a4140cfa-9133-4aa6-a0fe-061e3b69ebd1";

export const config = defaultConfig({
  appName: "STRAPT",
  walletConnectProjectId,
  xellarAppId,
  xellarEnv: "production",
  chains: [liskSepolia, baseSepolia],
}) as Config;

const queryClient = new QueryClient();

export const XellarProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <XellarKitProvider theme={darkTheme}>{children}</XellarKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};