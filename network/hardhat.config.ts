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
        count: 10,  // 修改账户数量（默认20）
        accountsBalance: "10000000000000000000000" // 每个账户10000 ETH
      }
    },
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    localhostB: {
      url: "http://127.0.0.1:8546"
    }
  }
};

export default config;