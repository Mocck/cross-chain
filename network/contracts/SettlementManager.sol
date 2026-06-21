// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./ICrossChain.sol";
import "./MessageVerifier.sol";

contract SettlementManager is ICrossChain, Ownable {
    MessageVerifier public immutable verifier;
    mapping(uint256 => Round) public rounds;

    event RoundFinished(uint256 indexed roundId, uint8 result);
    event SettlementGenerated(bytes32 indexed betId, uint8 result);

    constructor(address _verifier) Ownable(msg.sender) {
        verifier = MessageVerifier(_verifier);
    }

    /**
     * @notice 由源链上的下注事件同步（Relayer 传递）到结算链的记录方法
     */
    function registerRoundFromCrossChain(
        CrossChainMessage calldata message,
        bytes[] calldata signatures
    ) external {
        require(message.msgType == uint8(MessageType.BET_CREATED), "Invalid message type");
        require(verifier.verifyMessage(message, signatures), "Verifier check failed");
        
        (bytes32 betId, , , uint256 roundId) = abi.decode(message.data, (bytes32, address, uint256, uint256));
        
        if (!rounds[roundId].finished) {
            rounds[roundId] = Round({roundId: roundId, finished: false, result: 0});
        }
        emit SettlementGenerated(betId, 0);
    }

    /**
     * @notice 预言机/管理员开奖，输入结果
     */
    function finalizeRound(uint256 roundId, uint8 result) external onlyOwner {
        Round storage round = rounds[roundId];
        require(!round.finished, "Round already finalized");

        round.finished = true;
        round.result = result;

        emit RoundFinished(roundId, result);
    }
}