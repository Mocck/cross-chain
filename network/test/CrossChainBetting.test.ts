import { expect } from "chai";
import hre from "hardhat";
import { parseEther, encodePacked, keccak256, toHex, sha256 } from "viem";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";

describe("CrossChain Betting System - Core Tests", function () {

  async function deployContractsFixture() {
    const [owner, relayer1, relayer2, relayer3, player] = await hre.viem.getWalletClients();
    const publicClient = await hre.viem.getPublicClient();

    // Deploy MessageVerifier with 2-of-3 threshold
    const verifier = await hre.viem.deployContract("MessageVerifier", [
      [relayer1.account.address, relayer2.account.address, relayer3.account.address],
      2n
    ]);

    // Deploy BetManager
    const betManager = await hre.viem.deployContract("BetManager", [
      verifier.address
    ]);

    // Deploy SettlementManager
    const settlementManager = await hre.viem.deployContract("SettlementManager", [
      verifier.address
    ]);

    // Deploy HTLCVault
    const htlcVault = await hre.viem.deployContract("HTLCVault");

    return {
      verifier,
      betManager,
      settlementManager,
      htlcVault,
      owner,
      relayer1,
      relayer2,
      relayer3,
      player,
      publicClient
    };
  }

  describe("1. Contract Deployment", function () {
    it("Should deploy all contracts successfully", async function () {
      const { verifier, betManager, settlementManager, htlcVault } = await loadFixture(deployContractsFixture);

      expect(verifier.address).to.match(/^0x[a-fA-F0-9]{40}$/);
      expect(betManager.address).to.match(/^0x[a-fA-F0-9]{40}$/);
      expect(settlementManager.address).to.match(/^0x[a-fA-F0-9]{40}$/);
      expect(htlcVault.address).to.match(/^0x[a-fA-F0-9]{40}$/);
    });

    it("Should set correct threshold in MessageVerifier", async function () {
      const { verifier } = await loadFixture(deployContractsFixture);

      const threshold = await verifier.read.threshold();
      expect(threshold).to.equal(2n);
    });

    it("Should register relayers correctly", async function () {
      const { verifier, relayer1, relayer2, relayer3 } = await loadFixture(deployContractsFixture);

      expect(await verifier.read.isRelayer([relayer1.account.address])).to.be.true;
      expect(await verifier.read.isRelayer([relayer2.account.address])).to.be.true;
      expect(await verifier.read.isRelayer([relayer3.account.address])).to.be.true;
    });
  });

  describe("2. BetManager - Place Bet", function () {
    it("Should allow player to place a cross-chain bet", async function () {
      const { betManager, player, publicClient } = await loadFixture(deployContractsFixture);

      const targetChainId = 137n; // Polygon
      const receiverContract = "0x0000000000000000000000000000000000000001";
      const prediction = 1;
      const roundId = 1001n;
      const timeoutDuration = 3600n;
      const betAmount = parseEther("1.0");

      const hash = await betManager.write.placeBetCrossChain(
        [targetChainId, receiverContract, prediction, roundId, timeoutDuration],
        {
          account: player.account,
          value: betAmount
        }
      );

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      expect(receipt.status).to.equal("success");
    });

    it("Should emit BetCreatedCrossChain event", async function () {
      const { betManager, player, publicClient } = await loadFixture(deployContractsFixture);

      const hash = await betManager.write.placeBetCrossChain(
        [137n, "0x0000000000000000000000000000000000000001", 1, 1001n, 3600n],
        {
          account: player.account,
          value: parseEther("1.0")
        }
      );

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      // Check for event
      const events = await betManager.getEvents.BetCreatedCrossChain();
      expect(events.length).to.be.greaterThan(0);
    });

    it("Should reject bet with zero value", async function () {
      const { betManager, player } = await loadFixture(deployContractsFixture);

      await expect(
        betManager.write.placeBetCrossChain(
          [137n, "0x0000000000000000000000000000000000000001", 1, 1001n, 3600n],
          {
            account: player.account,
            value: 0n
          }
        )
      ).to.be.rejectedWith("Bet amount must > 0");
    });
  });

  describe("3. BetManager - Timeout Refund", function () {
    it("Should refund bet after timeout", async function () {
      const { betManager, player, publicClient } = await loadFixture(deployContractsFixture);

      const timeoutDuration = 60n; // 60 seconds
      const betAmount = parseEther("1.0");

      // Place bet
      const hash = await betManager.write.placeBetCrossChain(
        [137n, "0x0000000000000000000000000000000000000001", 1, 1001n, timeoutDuration],
        {
          account: player.account,
          value: betAmount
        }
      );

      await publicClient.waitForTransactionReceipt({ hash });

      // Calculate betId (same logic as contract)
      const chainId = await publicClient.getChainId();
      const betId = keccak256(
        encodePacked(
          ["uint256", "uint256", "address", "uint256"],
          [BigInt(chainId), 1n, player.account.address, 1001n]
        )
      );

      // Fast forward time past timeout
      await time.increase(61n);

      // Refund bet
      const refundHash = await betManager.write.refundTimeoutBet(
        [betId],
        { account: player.account }
      );

      const refundReceipt = await publicClient.waitForTransactionReceipt({ hash: refundHash });
      expect(refundReceipt.status).to.equal("success");
    });
  });

  describe("4. HTLCVault - Lock and Claim", function () {
    it("Should lock funds with hashlock", async function () {
      const { htlcVault, owner, player, publicClient } = await loadFixture(deployContractsFixture);

      const secret = "0x6d792d7365637265742d6b65792d313233000000000000000000000000000000";
      const hashlock = sha256(secret);
      const timeoutDuration = 3600n;
      const lockAmount = parseEther("5.0");

      const hash = await htlcVault.write.lock(
        [player.account.address, hashlock, timeoutDuration],
        {
          account: owner.account,
          value: lockAmount
        }
      );

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      expect(receipt.status).to.equal("success");
    });

    it("Should allow claim with correct secret", async function () {
      const { htlcVault, owner, player, publicClient } = await loadFixture(deployContractsFixture);

      const secret = "0x6d792d7365637265742d6b65792d343536000000000000000000000000000000";
      const hashlock = sha256(secret);

      // Lock funds
      const lockHash = await htlcVault.write.lock(
        [player.account.address, hashlock, 3600n],
        {
          account: owner.account,
          value: parseEther("3.0")
        }
      );

      const lockReceipt = await publicClient.waitForTransactionReceipt({ hash: lockHash });

      // Extract lockId from event
      const lockEvents = await htlcVault.getEvents.LogHTLCLocked();
      const lockId = lockEvents[lockEvents.length - 1].args.lockId;

      // Claim with secret
      const claimHash = await htlcVault.write.claim(
        [lockId!, secret],
        { account: player.account }
      );

      const claimReceipt = await publicClient.waitForTransactionReceipt({ hash: claimHash });
      expect(claimReceipt.status).to.equal("success");
    });
  });

  describe("5. SettlementManager", function () {
    it("Should allow owner to finalize round", async function () {
      const { settlementManager, owner, publicClient } = await loadFixture(deployContractsFixture);

      const roundId = 2001n;
      const result = 1;

      const hash = await settlementManager.write.finalizeRound(
        [roundId, result],
        { account: owner.account }
      );

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      expect(receipt.status).to.equal("success");
    });

    it("Should emit RoundFinished event", async function () {
      const { settlementManager, owner, publicClient } = await loadFixture(deployContractsFixture);

      const hash = await settlementManager.write.finalizeRound(
        [2002n, 2],
        { account: owner.account }
      );

      await publicClient.waitForTransactionReceipt({ hash });

      const events = await settlementManager.getEvents.RoundFinished();
      expect(events.length).to.be.greaterThan(0);
    });
  });
});
