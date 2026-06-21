const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const chainId = (await hre.network.provider.request({ method: "eth_chainId" }));
  const chainIdDecimal = parseInt(chainId, 16);

  console.log(`\n============================================================`);
  console.log(`Deploying contracts to chain ${chainIdDecimal}...`);
  console.log(`============================================================\n`);

  const relayer1 = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  const relayer2 = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const relayer3 = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";

  const [deployer] = await hre.viem.getWalletClients();
  console.log(`Deployer: ${deployer.account.address}\n`);

  // 1. Deploy MessageVerifier (2-of-3 门限签名)
  console.log("1/4 Deploying MessageVerifier (2-of-3)...");
  const verifier = await hre.viem.deployContract("MessageVerifier", [
    [relayer1, relayer2, relayer3],
    2n
  ]);
  console.log(`   MessageVerifier: ${verifier.address}`);

  // 2. Deploy BetManager
  console.log("2/4 Deploying BetManager...");
  const betManager = await hre.viem.deployContract("BetManager", [verifier.address]);
  console.log(`   BetManager:      ${betManager.address}`);

  // 3. Deploy SettlementManager
  console.log("3/4 Deploying SettlementManager...");
  const settlementManager = await hre.viem.deployContract("SettlementManager", [verifier.address]);
  console.log(`   SettlementManager: ${settlementManager.address}`);

  // 4. Deploy HTLCVault
  console.log("4/4 Deploying HTLCVault...");
  const htlcVault = await hre.viem.deployContract("HTLCVault");
  console.log(`   HTLCVault:        ${htlcVault.address}`);

  // 端口映射
  const portMap = { 31337: 8545, 31338: 8546 };

  // 构建输出
  const deployment = {
    network: "hardhat",
    chainId: chainIdDecimal,
    rpcUrl: portMap[chainIdDecimal] ? `http://127.0.0.1:${portMap[chainIdDecimal]}` : `http://127.0.0.1:8545`,
    contracts: {
      MessageVerifier: verifier.address,
      BetManager: betManager.address,
      SettlementManager: settlementManager.address,
      HTLCVault: htlcVault.address
    },
    accounts: {
      deployer: {
        address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
      },
      relayer1: {
        address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        privateKey: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
      },
      relayer2: {
        address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        privateKey: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"
      },
      relayer3: {
        address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
        privateKey: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6"
      }
    },
    note: "Local testnet addresses, deterministic per chain ID"
  };

  // 写入文件
  const outputPath = path.join(__dirname, "..", `deployed-${chainIdDecimal}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(deployment, null, 2));

  // 同时更新 deployed-addresses.json（总索引）
  const indexPath = path.join(__dirname, "..", "deployed-addresses.json");
  let index = {};
  if (fs.existsSync(indexPath)) {
    index = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
  }
  index[String(chainIdDecimal)] = deployment;
  index._lastUpdated = new Date().toISOString();
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

  console.log(`\n✅ Deployment complete! Saved to deployed-${chainIdDecimal}.json\n`);
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
