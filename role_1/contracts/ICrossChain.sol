// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title 统一跨链消息与状态枚举定义
 */
interface ICrossChain {
    enum MessageType { BET_CREATED, ROUND_RESULT, PAYOUT_CLAIM, REFUND }
    enum BetStatus { NONE, LOCKED, FINALIZED, CLAIMED, REFUNDED }

    struct CrossChainMessage {
        uint256 messageId;       // 全局唯一消息ID = keccak256(sourceChainId, nonce, msgType, keccak256(data))
        uint256 sourceChainId;   // 源链 EIP-155 Chain ID
        uint256 targetChainId;   // 目标链 EIP-155 Chain ID
        address sender;          // 发送者（源链触发合约或用户）
        address receiver;        // 接收者（目标链目标合约）
        uint8 msgType;           // 消息类型：0=BET_CREATED, 1=ROUND_RESULT, 2=PAYOUT_CLAIM, 3=REFUND
        bytes data;              // 业务层 ABI 编码数据
        uint256 timestamp;       // 消息创建时间
        uint256 timeout;         // 超时高度或时间戳
        bytes signature;         // 签名数据（多签流转可选）
    }

    struct Bet {
        bytes32 betId;
        address player;
        uint256 amount;
        uint8 prediction;
        uint256 roundId;
        uint256 timeout;
        BetStatus status;
    }

    struct LockInfo {
        address owner;
        uint256 amount;
        bytes32 hashlock;
        uint256 timeout;
        bool claimed;
        bool refunded;
    }

    struct Round {
        uint256 roundId;
        bool finished;
        uint8 result;
    }
}