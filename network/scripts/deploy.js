const hre = require("hardhat");

async function main() {
  console.log("Deploying contracts to local network...\n");

  const relayer1 = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  const relayer2 = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

  // 1. Deploy MessageVerifier
  console.log("Deploying MessageVerifier...");
  const verifier = await hre.viem.deployContract("MessageVerifier", [
    [relayer1, relayer2],
    2n
  ]);
  console.log("MessageVerifier deployed to:", verifier.address);

  // 2. Deploy BetManager
  console.log("\nDeploying BetManager...");
  const betManager = await hre.viem.deployContract("BetManager", [verifier.address]);
  console.log("BetManager deployed to:", betManager.address);

  // 3. Deploy SettlementManager
  console.log("\nDeploying SettlementManager...");
  const settlementManager = await hre.viem.deployContract("SettlementManager", [verifier.address]);
  console.log("SettlementManager deployed to:", settlementManager.address);

  // 4. Deploy HTLCVault (no constructor args)
  console.log("\nDeploying HTLCVault...");
  const htlcVault = await hre.viem.deployContract("HTLCVault");
  console.log("HTLCVault deployed to:", htlcVault.address);

  console.log("\n============================================================");
  console.log("Deployment Summary");
  console.log("============================================================");
  console.log("MessageVerifier:    ", verifier.address);
  console.log("BetManager:         ", betManager.address);
  console.log("SettlementManager:  ", settlementManager.address);
  console.log("HTLCVault:          ", htlcVault.address);
  console.log("============================================================");
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
