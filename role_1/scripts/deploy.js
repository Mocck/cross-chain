import hre from "hardhat";
import { createWalletClient, createPublicClient, http } from "viem";
import { hardhat } from "viem/chains";

async function main() {
    console.log("=== 正在通过原生 Viem 客户端建立本地区块链连接 ===");

    const localRpcUrl = "http://127.0.0.1:8545";

    // 1. 初始化公共客户端和钱包客户端
    const publicClient = createPublicClient({
        chain: hardhat,
        transport: http(localRpcUrl),
    });

    const walletClient = createWalletClient({
        chain: hardhat,
        transport: http(localRpcUrl),
    });

    // 2. 获取智能合约编译结果
    const getContractArtifact = async (contractName) => {
        const artifact = await hre.artifacts.readArtifact(contractName);
        return {
            abi: artifact.abi,
            bytecode: artifact.bytecode,
        };
    };

    console.log(`====================================================`);
    console.log(`Deploying CrossChain Architecture with Native Viem`);
    console.log(`====================================================`);

    // 多链架构 Relayer 多签集合预设 
    let initialRelayers = [
        "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        "0x90F79bf6EB2c4f870365E785982E1f101E93b906"
    ];
    let minThreshold = 2n;

    // 3. 👈 用纯 Viem 方式请求本地节点的钱包账户
    const [account] = await publicClient.request({ method: "eth_accounts" });
    if (!account) {
        throw new Error("💥 未能从本地节点获取到账户，请确保 'npx hardhat node' 已经在另一个终端启动！");
    }
    console.log(`Deployer Account: ${account}`);

    // --- 统一的原生部署函数 ---
    const deployContractNative = async (name, args = []) => {
        const { abi, bytecode } = await getContractArtifact(name);
        const hash = await walletClient.deployContract({
            abi,
            bytecode,
            account,
            args,
        });
        // 等待交易上链
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        return receipt.contractAddress;
    };

    // 1. Deploy MessageVerifier
    const verifierAddress = await deployContractNative("MessageVerifier", [initialRelayers, minThreshold]);
    console.log(`[✔] MessageVerifier deployed at: ${verifierAddress}`);

    // 2. Deploy BetManager
    const betManagerAddress = await deployContractNative("BetManager", [verifierAddress]);
    console.log(`[✔] BetManager deployed at: ${betManagerAddress}`);

    // 3. Deploy SettlementManager
    const settlementManagerAddress = await deployContractNative("SettlementManager", [verifierAddress]);
    console.log(`[✔] SettlementManager deployed at: ${settlementManagerAddress}`);

    // 4. Deploy HTLCVault
    const htlcVaultAddress = await deployContractNative("HTLCVault", []);
    console.log(`[✔] HTLCVault deployed at: ${htlcVaultAddress}`);

    console.log(`\nAll architectures synchronized deployment finished successfully.`);
}

main().catch((error) => {
    console.error("部署过程中发生错误:", error);
    process.exitCode = 1;
});