import React, { createContext, useContext, useState } from 'react';
import { ethers } from 'ethers';
import { CrossChainBettingSDK, LogLevel } from 'cross-chain-betting-sdk';

// ============================================================
// 链配置 — 本地可直接用，测试网需填 RPC URL + 合约地址
// ============================================================
const RPC_URL = (import.meta as any).env?.VITE_RPC_URL_31337 || 'http://127.0.0.1:8545';
const RPC_URL_31338 = (import.meta as any).env?.VITE_RPC_URL_31338 || 'http://127.0.0.1:8546';

export interface ChainOption {
  chainId: string;
  name: string;
  rpcUrl: string;
  betManagerAddress: string;
  settlementManagerAddress: string;
  verifierAddress: string;
}

export const ALL_CHAINS: ChainOption[] = [
  {
    chainId: '31337', name: 'Hardhat A',
    rpcUrl: RPC_URL,
    betManagerAddress: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    settlementManagerAddress: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    verifierAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  },
  {
    chainId: '31338', name: 'Hardhat B',
    rpcUrl: RPC_URL_31338,
    betManagerAddress: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    settlementManagerAddress: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    verifierAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  },
  {
    chainId: '11155111', name: 'Sepolia',
    rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
    betManagerAddress: '',
    settlementManagerAddress: '',
    verifierAddress: '',
  },
  {
    chainId: '80002', name: 'Polygon Amoy',
    rpcUrl: 'https://polygon-amoy-bor-rpc.publicnode.com',
    betManagerAddress: '',
    settlementManagerAddress: '',
    verifierAddress: '',
  },
  {
    chainId: '97', name: 'BSC Testnet',
    rpcUrl: 'https://bsc-testnet-rpc.publicnode.com',
    betManagerAddress: '',
    settlementManagerAddress: '',
    verifierAddress: '',
  },
  {
    chainId: '421614', name: 'Arbitrum Sepolia',
    rpcUrl: 'https://arbitrum-sepolia-rpc.publicnode.com',
    betManagerAddress: '',
    settlementManagerAddress: '',
    verifierAddress: '',
  },
];

function buildSDKConfig(chains: ChainOption[]) {
  const map: Record<string, any> = {};
  for (const c of chains) {
    if (!c.rpcUrl || !c.betManagerAddress) continue;
    map[c.chainId] = {
      chainId: c.chainId,
      rpcUrl: c.rpcUrl,
      betManagerAddress: c.betManagerAddress,
      settlementManagerAddress: c.settlementManagerAddress,
      verifierAddress: c.verifierAddress,
    };
  }
  return { chains: map, relayerBaseUrl: 'http://localhost:8080' };
}

// ============================================================
// Context
// ============================================================
interface SDKContextType {
  sdk: CrossChainBettingSDK | null;
  account: string | null;
  isConnected: boolean;
  chains: ChainOption[];
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  connectDev: () => void;
}

const SDKContext = createContext<SDKContextType>({
  sdk: null, account: null, isConnected: false, chains: [],
  connectWallet: async () => {}, disconnectWallet: () => {}, connectDev: () => {},
});

export const useSDK = () => useContext(SDKContext);

export const SDKProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sdk] = useState(() => new CrossChainBettingSDK(buildSDKConfig(ALL_CHAINS), LogLevel.INFO));
  const [account, setAccount] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const connectWallet = async () => {
    if (!window.ethereum) { alert('Please install MetaMask, or use Dev Connect'); return; }
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    sdk.connect(signer);
    setAccount(ethers.getAddress(accounts[0]));
    setIsConnected(true);
  };

  const connectDev = () => {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(
      '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      provider
    );
    sdk.connect(wallet as any);
    setAccount(wallet.address);
    setIsConnected(true);
  };

  const disconnectWallet = () => { setAccount(null); setIsConnected(false); };

  return (
    <SDKContext.Provider value={{ sdk, account, isConnected, chains: ALL_CHAINS, connectWallet, disconnectWallet, connectDev }}>
      {children}
    </SDKContext.Provider>
  );
};
