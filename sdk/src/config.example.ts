// SDK 配置示例
// 双链本地测试网络

import { SDKConfig } from './types';

export const LOCAL_CONFIG: SDKConfig = {
  chains: {
    '31337': {
      chainId: '31337',
      rpcUrl: 'http://127.0.0.1:8545',
      betManagerAddress: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
      settlementManagerAddress: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
      verifierAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3'
    },
    '31338': {
      chainId: '31338',
      rpcUrl: 'http://127.0.0.1:8546',
      betManagerAddress: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
      settlementManagerAddress: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
      verifierAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3'
    }
  },
  relayerBaseUrl: 'http://localhost:8080'
};

// 测试网配置示例（Sepolia + Polygon Mumbai）
export const TESTNET_CONFIG: SDKConfig = {
  chains: {
    // Sepolia
    '11155111': {
      chainId: '11155111',
      rpcUrl: 'https://rpc.sepolia.org',
      betManagerAddress: '0x...', // 部署后填入
      settlementManagerAddress: '0x...',
      verifierAddress: '0x...'
    },
    // Polygon Mumbai
    '80001': {
      chainId: '80001',
      rpcUrl: 'https://rpc-mumbai.maticvigil.com',
      betManagerAddress: '0x...', // 部署后填入
      settlementManagerAddress: '0x...',
      verifierAddress: '0x...'
    }
  },
  relayerBaseUrl: 'https://your-relayer-service.com'
};
