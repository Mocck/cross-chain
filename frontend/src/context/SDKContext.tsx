// src/context/SDKContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { CrossChainBettingSDK } from '../sdk/CrossChainSDK';

const SDKContext = createContext<CrossChainBettingSDK | null>(null);

export const useSDK = () => useContext(SDKContext);

export const SDKProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sdk, setSDK] = useState<CrossChainBettingSDK | null>(null);

  useEffect(() => {
    // 直接创建 mock SDK，不依赖任何钱包状态
    const sdkInstance = new CrossChainBettingSDK({
      signer: null as any,      // mock SDK 会处理 null
      defaultChainId: '11155111', // 临时固定 Sepolia 链 ID
      relayerUrl: 'http://localhost:3001', // 临时占位
    });
    setSDK(sdkInstance);
  }, []);

  return <SDKContext.Provider value={sdk}>{children}</SDKContext.Provider>;
};