// 👈 1. 导入插件的默认导出对象
import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";

/** @type {import('hardhat/config').HardhatUserConfig} */
const config = {
  // 👈 2. 必须在经典平铺格式中，显式写在 plugins 数组里！
  plugins: [hardhatToolboxViemPlugin], 
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      type: "edr-simulated",
      chainType: "l1",
      chainId: process.env.HARDHAT_CHAIN_ID ? parseInt(process.env.HARDHAT_CHAIN_ID) : 31337,
      accounts: {
        count: 10,
        accountsBalance: "10000000000000000000000"
      }
    },
    localhost: { url: "http://127.0.0.1:8545" },
    localhostB: { url: "http://127.0.0.1:8546" },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    polygonAmoy: {
      url: process.env.POLYGON_RPC_URL || "https://rpc-amoy.polygon.technology",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    bscTestnet: {
      url: process.env.BSC_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    arbitrumSepolia: {
      url: process.env.ARB_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    }
  }
};

export default config;