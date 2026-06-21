import { ethers, Signer, Provider, Contract } from 'ethers';
import { SDKConfig, ChainConfig, BetInfo, BetStatus, RelayerMessageResponse, ERROR_CODES, MSG_TYPE } from './types';
import { CrossChainError } from './errors';
import { BET_MANAGER_ABI, SETTLEMENT_MANAGER_ABI } from './abis';
import { RelayerClient } from './relayer';
import { withRetry } from './utils';
import { SDKLogger, LogLevel } from './logger';

export { MSG_TYPE, ERROR_CODES, BetStatus } from './types';
export { CrossChainError } from './errors';
export { LogLevel } from './logger';

export class CrossChainBettingSDK {
  private config: SDKConfig;
  private providers: Record<string, Provider> = {};
  private signer: Signer | null = null;
  private relayer: RelayerClient;
  private logger: SDKLogger;

  constructor(config: SDKConfig, logLevel: LogLevel = LogLevel.INFO) {
    this.config = config;
    this.relayer = new RelayerClient(config.relayerBaseUrl);
    this.logger = new SDKLogger(logLevel);

    for (const chainId in config.chains) {
      this.providers[chainId] = new ethers.JsonRpcProvider(config.chains[chainId].rpcUrl);
      this.logger.debug(`Initialized provider for chain ${chainId}`);
    }
  }

  public connect(signer: Signer) {
    this.signer = signer;
    this.logger.info("Wallet signer connected to SDK.");
    return this;
  }

  private getContract(chainId: string, withSigner: boolean = false): Contract {
    const chainConfig = this.config.chains[chainId];
    if (!chainConfig) throw new CrossChainError(ERROR_CODES.WRONG_CHAIN, `Chain ${chainId} not configured.`);

    const provider = this.providers[chainId];
    const contract = new ethers.Contract(chainConfig.betManagerAddress, BET_MANAGER_ABI, provider);

    if (withSigner) {
      if (!this.signer) throw new Error("Signer not connected. Call .connect(signer) first.");
      return contract.connect(this.signer) as Contract;
    }
    return contract;
  }

  /// 1. 跨链下注
  async placeBet(params: {
    targetChainId: string;
    receiverContract: string;
    prediction: number;
    roundId: string;
    timeoutDuration: number;
    amount: string;
    sourceChainId: string;
  }) {
    this.logger.info(`Placing cross-chain bet to chain ${params.targetChainId}...`);
    try {
      const contract = this.getContract(params.sourceChainId, true);
      const value = BigInt(params.amount);

      const tx = await contract.placeBetCrossChain(
        params.targetChainId,
        params.receiverContract,
        params.prediction,
        params.roundId,
        params.timeoutDuration,
        { value }
      );

      this.logger.debug(`Bet Tx sent: ${tx.hash}`);
      const receipt = await tx.wait();

      // 从事件中提取 betId
      let betId = "";
      for (const log of receipt.logs) {
        try {
          const parsedLog = contract.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog && parsedLog.name === 'BetCreatedCrossChain') {
            betId = parsedLog.args.betId || parsedLog.args[0]; // betId 是第一个参数
            this.logger.debug(`Found BetCreatedCrossChain event: betId=${betId}`);
            break;
          }
        } catch (e) {
          // 忽略无法解析的日志
        }
      }

      if (!betId) {
        this.logger.warn("BetCreatedCrossChain event not found in transaction receipt");
        this.logger.debug(`Receipt logs: ${JSON.stringify(receipt.logs.map((l: any) => ({ address: l.address, topics: l.topics })))}`);
      }

      this.logger.info(`Bet placed! BetID: ${betId}`);
      return { txHash: receipt.hash, betId };
    } catch (error: any) {
      this.logger.error("Place bet failed", error);
      if (error.message?.includes('insufficient funds')) {
        throw new CrossChainError(ERROR_CODES.INSUFFICIENT_FUNDS, "Insufficient funds");
      }
      throw error;
    }
  }

  /// 2. 查询下注信息
  async getBetInfo(params: { betId: string; chainId: string }): Promise<BetInfo> {
    this.logger.debug(`Fetching bet info for ${params.betId} on chain ${params.chainId}`);
    return withRetry(async () => {
      const contract = this.getContract(params.chainId);
      const result = await contract.bets(params.betId);

      return {
        betId: result.betId,
        player: result.player,
        amount: result.amount.toString(),
        prediction: Number(result.prediction),
        roundId: result.roundId.toString(),
        timeout: Number(result.timeout),
        status: Number(result.status) as BetStatus
      };
    }, 3);
  }

  /// 3. 超时退款
  async refund(params: { betId: string; chainId: string }): Promise<{ txHash: string; amount: string }> {
    this.logger.info(`Processing refund for bet ${params.betId}...`);
    try {
      // 先查询 bet 信息
      const betInfo = await this.getBetInfo(params);

      if (betInfo.status !== BetStatus.LOCKED) {
        throw new CrossChainError(ERROR_CODES.BET_CLOSED, "Bet is not in LOCKED status");
      }

      const currentTime = Math.floor(Date.now() / 1000);
      if (currentTime <= betInfo.timeout) {
        throw new CrossChainError(ERROR_CODES.GAME_EXPIRED, "Bet has not timed out yet");
      }

      const contract = this.getContract(params.chainId, true);
      const tx = await contract.refundTimeoutBet(params.betId);
      const receipt = await tx.wait();

      this.logger.info(`Refund successful! TxHash: ${receipt.hash}`);
      return { txHash: receipt.hash, amount: betInfo.amount };
    } catch (error: any) {
      this.logger.error("Refund failed", error);
      throw error;
    }
  }

  /// 4. 查询合约 nonce（用于计算 messageId）
  async getNonce(chainId: string): Promise<number> {
    const contract = this.getContract(chainId);
    const nonce = await contract.nonce();
    return Number(nonce);
  }

  /// 5. 查询跨链消息状态（需要 Relayer）
  async getMessageStatus(params: { messageId: string }): Promise<RelayerMessageResponse> {
    this.logger.debug(`Fetching message status: ${params.messageId}`);
    try {
      return await this.relayer.getMessageStatus(params.messageId);
    } catch (error: any) {
      this.logger.warn(`Failed to fetch message status: ${error.message}`);
      throw new CrossChainError(ERROR_CODES.RELAYER_FAILED, 'Failed to get message status from relayer');
    }
  }

  /// 6. 轮询等待消息完成（需要 Relayer）
  async waitForMessageDelivered(messageId: string, pollInterval = 3000, timeout = 300000): Promise<RelayerMessageResponse> {
    this.logger.info(`Polling for message status: ${messageId}`);
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        try {
          const status = await this.getMessageStatus({ messageId });
          if (status.status === 'delivered') {
            this.logger.info(`Message ${messageId} delivered successfully!`);
            clearInterval(interval);
            resolve(status);
          } else if (status.status === 'failed') {
            this.logger.error(`Message ${messageId} delivery failed.`);
            clearInterval(interval);
            reject(new CrossChainError(ERROR_CODES.RELAYER_FAILED, 'Cross-chain message failed.'));
          }

          if (Date.now() - startTime > timeout) {
            this.logger.warn(`Polling for message ${messageId} timed out.`);
            clearInterval(interval);
            reject(new CrossChainError(ERROR_CODES.MESSAGE_EXPIRED, 'Wait for message timeout.'));
          }
        } catch (err) {
          this.logger.debug(`Polling error (retrying next tick): ${err}`);
        }
      }, pollInterval);
    });
  }

  /// 7. 获取当前连接的链ID（方便 Frontend 调用）
  getCurrentChainId(): string | null {
    if (!this.signer) return null;
    // 返回第一个配置的链ID作为默认
    return Object.keys(this.config.chains)[0] || null;
  }
}
