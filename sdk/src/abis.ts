// BetManager 合约 ABI - 跨链下注合约
export const BET_MANAGER_ABI = [
  // 下注函数
  "function placeBetCrossChain(uint256 targetChainId, address receiverContract, uint8 prediction, uint256 roundId, uint256 timeoutDuration) external payable returns (bytes32)",

  // 退款函数
  "function refundTimeoutBet(bytes32 betId) external",

  // 查询函数
  "function bets(bytes32) external view returns (bytes32 betId, address player, uint256 amount, uint8 prediction, uint256 roundId, uint256 timeout, uint8 status)",
  "function nonce() external view returns (uint256)",

  // 事件
  "event BetCreatedCrossChain(bytes32 indexed betId, address indexed player, uint256 amount, uint256 targetChainId)",
  "event BetFinalized(bytes32 indexed betId, uint256 payout)",
  "event BetRefunded(bytes32 indexed betId)"
];

// SettlementManager 合约 ABI
export const SETTLEMENT_MANAGER_ABI = [
  "function finalizeRound(uint256 roundId, uint8 result) external",
  "function rounds(uint256) external view returns (uint256 roundId, uint8 result, bool finalized)",
  "event RoundFinished(uint256 indexed roundId, uint8 result)"
];