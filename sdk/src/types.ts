// 跨链消息类型枚举
export const MSG_TYPE = {
  BET: 1,
  RESULT: 2,
  CLAIM: 3,
  REFUND: 4,
} as const;

// 错误码体系
export const ERROR_CODES = {
  SUCCESS: 0,
  INVALID_SIGNATURE: 1001,
  MESSAGE_EXPIRED: 1002,
  DUPLICATE_MESSAGE: 1003,
  INVALID_NONCE: 1004,
  WRONG_CHAIN: 1005,
  GAME_NOT_EXIST: 2001,
  BET_CLOSED: 2002,
  GAME_RESOLVED: 2003,
  GAME_EXPIRED: 2004,
  ALREADY_CLAIMED: 2005,
  RELAYER_FAILED: 3001,
  RELAYER_NOT_FOUND: 3002,
  THRESHOLD_NOT_MET: 3003,
  INSUFFICIENT_FUNDS: 4001,
  LOCK_NOT_FOUND: 4002,
  LOCK_EXPIRED: 4003,
  REFUND_FAILED: 4004,
} as const;

// 下注状态枚举
export enum BetStatus {
  NONE = 0,
  LOCKED = 1,
  FINALIZED = 2,
  CLAIMED = 3,
  REFUNDED = 4
}

// 跨链消息结构体
export interface CrossChainMessage {
  messageId: string;
  sourceChainId: string;
  targetChainId: string;
  sender: string;
  receiver: string;
  msgType: number;
  data: string;
  timestamp: number;
  timeout: number;
  signature?: string;
}

// 下注信息结构体
export interface BetInfo {
  betId: string;
  player: string;
  amount: string;
  prediction: number;
  roundId: string;
  timeout: number;
  status: BetStatus;
}

// 游戏信息结构体（兼容旧代码）
export interface GameInfo {
  gameId: string;
  question: string;
  options: string[];
  deadline: number;
  totalPool: string;
  status: number;
  creator: string;
}

// 消息状态类型
export type MessageStatus = 'pending' | 'confirmed' | 'signed' | 'delivered' | 'failed';

export interface RelayerMessageResponse {
  messageId: string;
  status: MessageStatus;
  sourceChainId: string;
  targetChainId: string;
  msgType: number;
  confirmations: number;
  requiredConfirmations: number;
  signatures: number;
  requiredSignatures: number;
  createdAt: number;
  deliveredAt: number;
  txHash: string;
}

// SDK 配置项
export interface ChainConfig {
  chainId: string;
  rpcUrl: string;
  betManagerAddress: string;
  settlementManagerAddress?: string;
  verifierAddress?: string;
}

export interface SDKConfig {
  chains: Record<string, ChainConfig>; // chainId => ChainConfig
  relayerBaseUrl: string;
}