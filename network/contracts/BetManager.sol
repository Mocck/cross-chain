// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ICrossChain.sol";
import "./MessageVerifier.sol";

contract BetManager is ICrossChain, ReentrancyGuard, Ownable {
    MessageVerifier public immutable verifier;
    mapping(bytes32 => Bet) public bets;
    uint256 public nonce;

    event BetCreatedCrossChain(bytes32 indexed betId, address indexed player, uint256 amount, uint256 targetChainId);
    event BetFinalized(bytes32 indexed betId, uint256 payout);
    event BetRefunded(bytes32 indexed betId);

    constructor(address _verifier) Ownable(msg.sender) {
        verifier = MessageVerifier(_verifier);
    }

    /**
     * @notice 用户在源链下注，冻结并初始化状态，产生跨链同步事件
     */
    function placeBetCrossChain(
        uint256 targetChainId,
        address receiverContract,
        uint8 prediction,
        uint256 roundId,
        uint256 timeoutDuration
    ) external payable nonReentrant returns (bytes32) {
        require(msg.value > 0, "Bet amount must > 0");
        
        nonce++;
        bytes32 betId = keccak256(abi.encodePacked(block.chainid, nonce, msg.sender, roundId));
        
        bets[betId] = Bet({
            betId: betId,
            player: msg.sender,
            amount: msg.value,
            prediction: prediction,
            roundId: roundId,
            timeout: block.timestamp + timeoutDuration,
            status: BetStatus.LOCKED
        });

        emit BetCreatedCrossChain(betId, msg.sender, msg.value, targetChainId);
        return betId;
    }

    /**
     * @notice 接收并执行来自结算链（Settlement Chain）的结算消息
     */
    function executeSettlement(
        CrossChainMessage calldata message,
        bytes[] calldata signatures
    ) external nonReentrant {
        require(message.msgType == uint8(MessageType.ROUND_RESULT), "Invalid msg type");
        require(verifier.verifyMessage(message, signatures), "Crypto verification failed");

        (bytes32 betId, uint8 winningResult) = abi.decode(message.data, (bytes32, uint8));
        Bet storage bet = bets[betId];
        
        require(bet.status == BetStatus.LOCKED, "Bet status invalid");

        if (bet.prediction == winningResult) {
            bet.status = BetStatus.FINALIZED;
            uint256 payout = bet.amount * 2; // 简化业务：胜者获得双倍奖金 pool
            
            // 考虑本地池资金充裕度，若不足则进行标记支持 HTLC 异步 claim
            if (address(this).balance >= payout) {
                bet.status = BetStatus.CLAIMED;
                payable(bet.player).transfer(payout);
                emit BetFinalized(betId, payout);
            } else {
                emit BetFinalized(betId, payout);
            }
        } else {
            bet.status = BetStatus.FINALIZED; // 输掉竞猜，资金归集至平台
            emit BetFinalized(betId, 0);
        }
    }

    /**
     * @notice 源链本地超时应急退款
     */
    function refundTimeoutBet(bytes32 betId) external nonReentrant {
        Bet storage bet = bets[betId];
        require(bet.status == BetStatus.LOCKED, "Cannot refund");
        require(block.timestamp > bet.timeout, "Not timeout yet");

        bet.status = BetStatus.REFUNDED;
        payable(bet.player).transfer(bet.amount);
        emit BetRefunded(betId);
    }

    receive() external payable {}
}