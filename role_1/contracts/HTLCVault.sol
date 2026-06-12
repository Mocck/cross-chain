// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ICrossChain.sol";

/**
 * @title HTLCVault
 * @notice 支持大额跨链资金清算的哈希时间锁定合约（原子性安全机制）
 */
contract HTLCVault is ICrossChain, ReentrancyGuard {
    mapping(bytes32 => LockInfo) public locks;

    event LogHTLCLocked(bytes32 indexed lockId, address indexed owner, uint256 amount, bytes32 hashlock, uint256 timeout);
    event LogHTLCOpened(bytes32 indexed lockId, bytes secret);
    event LogHTLCRefunded(bytes32 indexed lockId);

    /**
     * @notice 锁定资金，通过 secret 的 sha256 哈希作为条件锁
     */
    function lock(
        address receiver,
        bytes32 hashlock,
        uint256 timeoutDuration
    ) external payable nonReentrant returns (bytes32 lockId) {
        require(msg.value > 0, "Funds must > 0");
        require(timeoutDuration > 0, "Expiry must > 0");

        lockId = keccak256(abi.encodePacked(msg.sender, receiver, msg.value, hashlock, block.timestamp));
        require(locks[lockId].timeout == 0, "LockId collision");

        locks[lockId] = LockInfo({
            owner: msg.sender,
            amount: msg.value,
            hashlock: hashlock,
            timeout: block.timestamp + timeoutDuration,
            claimed: false,
            refunded: false
        });

        emit LogHTLCLocked(lockId, receiver, msg.value, hashlock, block.timestamp + timeoutDuration);
        return lockId;
    }

    /**
     * @notice 接收方提供正确原像（Secret），提取资金
     */
    function claim(bytes32 lockId, bytes calldata secret) external nonReentrant {
        LockInfo storage htlc = locks[lockId];
        require(!htlc.claimed, "Already claimed");
        require(!htlc.refunded, "Already refunded");
        require(block.timestamp <= htlc.timeout, "HTLC lock expired");
        require(sha256(secret) == htlc.hashlock, "Invalid secret");

        htlc.claimed = true;
        payable(msg.sender).transfer(htlc.amount);

        emit LogHTLCOpened(lockId, secret);
    }

    /**
     * @notice 超时后由原锁定人无条件退回本金
     */
    function refund(bytes32 lockId) external nonReentrant {
        LockInfo storage htlc = locks[lockId];
        require(!htlc.claimed, "Already claimed");
        require(!htlc.refunded, "Already refunded");
        require(block.timestamp > htlc.timeout, "HTLC not expired yet");

        htlc.refunded = true;
        payable(htlc.owner).transfer(htlc.amount);

        emit LogHTLCRefunded(lockId);
    }
}