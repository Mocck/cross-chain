import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying contracts to local network...\n");

  // 1. 部署 MessageVerifier
  console.log("📝 Deploying MessageVerifier...");
  const MessageVerifier = await ethers.getContractFactory("MessageVerifier");
  const verifier = await MessageVerifier.deploy(2); // threshold = 2
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  console.log(`✅ MessageVerifier deployed to: ${verifierAddress}`);

  // 2. 添加 Relayer 地址
  const relayer1 = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // Hardhat Account #0
  const relayer2 = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // Hardhat Account #1

  console.log("\n📝 Adding relayers to MessageVerifier...");
  await verifier.addRelayer(relayer1);
  await verifier.addRelayer(relayer2);
  console.log(`✅ Added relayer: ${relayer1}`);
  console.log(`✅ Added relayer: ${relayer2}`);

  // 3. 部署 BetManager
  console.log("\n📝 Deploying BetManager...");
  const BetManager = await ethers.getContractFactory("BetManager");
  const betManager = await BetManager.deploy(verifierAddress);
  await betManager.waitForDeployment();
  const betManagerAddress = await betManager.getAddress();
  console.log(`✅ BetManager deployed to: ${betManagerAddress}`);

  // 4. 部署 SettlementManager
  console.log("\n📝 Deploying SettlementManager...");
  const SettlementManager = await ethers.getContractFactory("SettlementManager");
  const settlementManager = await SettlementManager.deploy(verifierAddress);
  await settlementManager.waitForDeployment();
  const settlementManagerAddress = await settlementManager.getAddress();
  console.log(`✅ SettlementManager deployed to: ${settlementManagerAddress}`);

  // 5. 部署 HTLCVault
  console.log("\n📝 Deploying HTLCVault...");
  const HTLCVault = await ethers.getContractFactory("HTLCVault");
  const htlcVault = await HTLCVault.deploy(verifierAddress);
  await htlcVault.waitForDeployment();
  const htlcVaultAddress = await htlcVault.getAddress();
  console.log(`✅ HTLCVault deployed to: ${htlcVaultAddress}`);

  // 6. 输出配置
  console.log("\n" + "=".repeat(60));
  console.log("📋 Deployment Summary");
  console.log("=".repeat(60));
  console.log(`MessageVerifier:     ${verifierAddress}`);
  console.log(`BetManager:          ${betManagerAddress}`);
  console.log(`SettlementManager:   ${settlementManagerAddress}`);
  console.log(`HTLCVault:           ${htlcVaultAddress}`);
  console.log("=".repeat(60));
  console.log("\n✅ All contracts deployed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
