import { ethers } from 'ethers';

/**
 * 按照规范 3.1: 编码下注消息的数据 (data)
 */
export function encodeBetData(
  gameId: string,
  player: string,
  amount: string,
  choice: number,
  chainId: string
): string {
  const abiCoder = new ethers.AbiCoder();
  return abiCoder.encode(
    ["uint256", "address", "uint256", "uint8", "uint256"],
    [gameId, player, amount, choice, chainId]
  );
}

/**
 * 按照规范 9.1: 计算跨链全局唯一 messageId
 */
export function calculateMessageId(
  sourceChainId: string,
  nonce: string,
  msgType: number,
  data: string
): string {
  const dataHash = ethers.keccak256(data);
  return ethers.solidityPackedKeccak256(
    ["uint256", "uint256", "uint8", "bytes32"],
    [sourceChainId, nonce, msgType, dataHash]
  );
}

/**
 * 通用的带退避机制的重试函数
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let attempt = 1;
  while (attempt <= maxAttempts) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      await new Promise(res => setTimeout(res, delayMs * attempt));
      attempt++;
    }
  }
  throw new Error("Retry failed");
}