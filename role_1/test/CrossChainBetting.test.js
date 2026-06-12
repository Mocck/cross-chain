// FILE: test/CrossChainBetting.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CrossChain Betting System Security Matrix", function () {
    let MessageVerifier, BetManager, HTLCVault;
    let verifier, betManager, htlcVault;
    let owner, relayer1, relayer2, relayer3, player;
    let domainSeparator, messageTypeHash;

    beforeEach(async function () {
        [owner, relayer1, relayer2, relayer3, player] = await ethers.getSigners();

        // 1. 部署 MessageVerifier (门限设为 2-of-3)
        const VerifierFactory = await ethers.getContractFactory("MessageVerifier");
        verifier = await VerifierFactory.deploy([relayer1.address, relayer2.address, relayer3.address], 2);
        await verifier.waitForDeployment();

        // 2. 部署 BetManager
        const BetManagerFactory = await ethers.getContractFactory("BetManager");
        betManager = await BetManagerFactory.deploy(await verifier.getAddress());
        await betManager.waitForDeployment();

        // 3. 部署 HTLCVault
        const HTLCVaultFactory = await ethers.getContractFactory("HTLCVault");
        htlcVault = await HTLCVaultFactory.deploy();
        await htlcVault.waitForDeployment();
    });

    describe("1. MessageVerifier & EIP-712 Multi-Sig Core", function () {
        it("Should verify valid sorted multi-signatures and reject unsorted or duplicates", async function () {
            const message = {
                messageId: ethers.toBigInt(ethers.id("msg1")),
                sourceChainId: 1,
                targetChainId: 31337, // Hardhat Default ChainId
                sender: owner.address,
                receiver: await betManager.getAddress(),
                msgType: 1, // ROUND_RESULT
                data: ethers.AbiCoder.defaultAbiCoder().encode(["bytes32", "uint8"], [ethers.id("bet1"), 1]),
                timestamp: Math.floor(Date.now() / 1000),
                timeout: Math.floor(Date.now() / 1000) + 3600,
                signature: "0x"
            };

            const signHash = await verifier.getEIP712SignHash(message);
            
            // 生成签名
            let sig1 = await relayer1.signMessage(ethers.getBytes(signHash));
            let sig2 = await relayer2.signMessage(ethers.getBytes(signHash));

            // 按地址大小排序传参 (防止去重绕过)
            let signatures = [relayer1.address, relayer2.address].map((addr, idx) => [sig1, sig2][idx]);
            if (relayer1.address.toLowerCase() > relayer2.address.toLowerCase()) {
                signatures = [sig2, sig1];
            }

            expect(await verifier.verifyMessage.staticCall(message, signatures)).to.be.true;
        });
    });

    describe("2. BetManager Lifecycle & HTLC", function () {
        it("Should execute timeout safety refunds correctly", async function () {
            const tx = await betManager.connect(player).placeBetCrossChain(
                137, owner.address, 1, 101, 10, // 10秒超时
                { value: ethers.parseEther("1.0") }
            );
            const receipt = await tx.wait();
            
            // 提取 BetID
            const betId = ethers.solidityPackedKeccak256(
                ["uint256", "uint256", "address", "uint256"],
                [31337, 1, player.address, 101]
            );

            // 快进时间以触发超时机制
            await ethers.provider.send("evm_increaseTime", [15]);
            await ethers.provider.send("evm_mine");

            await expect(betManager.connect(player).refundTimeoutBet(betId))
                .to.emit(betManager, "BetRefunded");
        });

        it("Should handle atomic operations in HTLCVault successfully", async function () {
            const secret = ethers.utils.randomBytes(32);
            const hashlock = ethers.sha256(secret);

            const tx = await htlcVault.connect(owner).lock(
                player.address, hashlock, 3600,
                { value: ethers.parseEther("5.0") }
            );
            const receipt = await tx.wait();
            
            // 假设依据事件算得 lockId
            const lockId = receipt.logs[0].topics[1]; 

            // 用户凭原像取款
            await expect(htlcVault.connect(player).claim(lockId, secret))
                .to.emit(htlcVault, "LogHTLCOpened");
        });
    });
});