// src/sdk/CrossChainSDK.ts
import { ethers } from 'ethers';

export interface SDKConfig {
  signer: any;
  defaultChainId: string;
  relayerUrl: string;
}

export interface GameInfo {
  gameId: string;
  question: string;
  options: string[];
  deadline: number;
  totalPool: string;
  status: string;        // 'BETTING' | 'LOCKED' | 'SETTLED' | 'EXPIRED'
  creator: string;
  winningOption?: number;
}

// 内存存储
const gamesStore: Record<string, any> = {};
const messagesStore: Record<string, { status: string; updateCount: number }> = {};

export class CrossChainBettingSDK {
  private signer: any;
  private chainId: string;
  private mockAddress: string;

  constructor(config: SDKConfig) {
    this.signer = config.signer;
    this.chainId = config.defaultChainId;
    this.mockAddress = '0xMockUserAddressForTesting';
  }

  private async getSignerAddress(): Promise<string> {
    if (this.signer && typeof this.signer.getAddress === 'function') {
      try {
        return await this.signer.getAddress();
      } catch {
        return this.mockAddress;
      }
    }
    return this.mockAddress;
  }

  async createGame(params: {
    question: string;
    options: string[];
    deadline: number;
    chainId: string;
  }): Promise<{ gameId: string; txHash: string }> {
    await this.delay(1000);
    const gameId = Math.floor(Math.random() * 1000000).toString();
    const creator = await this.getSignerAddress();
    gamesStore[gameId] = {
      gameId,
      question: params.question,
      options: params.options,
      deadline: params.deadline,
      totalPool: ethers.utils.parseEther('1').toString(),
      status: 'BETTING',
      creator,
    };
    return { gameId, txHash: '0x' + Math.random().toString(36).substring(2, 10) };
  }

  async placeBet(params: {
    gameId: string;
    choice: number;
    amount: string;
    chainId: string;
  }): Promise<{ txHash: string; messageId: string }> {
    await this.delay(1500);
    const game = gamesStore[params.gameId];
    if (!game) throw new Error('GAME_NOT_EXIST');
    if (game.status !== 'BETTING') throw new Error('BET_CLOSED');
    // 更新奖池
    game.totalPool = ethers.BigNumber.from(game.totalPool).add(params.amount).toString();
    const player = await this.getSignerAddress();
    if (!game.bets) game.bets = [];
    game.bets.push({ player, choice: params.choice, amount: params.amount });
    const messageId = '0x' + Math.random().toString(36).substring(2, 18);
    messagesStore[messageId] = { status: 'pending', updateCount: 0 };
    this.simulateMessageProgress(messageId);
    return { txHash: '0x' + Math.random().toString(36).substring(2, 10), messageId };
  }

  async getGameInfo(params: { gameId: string; chainId: string }): Promise<GameInfo> {
    await this.delay(500);
    const game = gamesStore[params.gameId];
    if (!game) throw new Error('GAME_NOT_EXIST');
    return { ...game };
  }

  async claimReward(params: { gameId: string; chainId: string }): Promise<{ txHash: string; amount: string }> {
    await this.delay(1000);
    const game = gamesStore[params.gameId];
    if (!game) throw new Error('GAME_NOT_EXIST');
    if (game.status !== 'SETTLED') throw new Error('GAME_RESOLVED');
    const player = await this.getSignerAddress();
    const userBet = game.bets?.find((b: any) => b.player === player);
    if (!userBet) throw new Error('NO_BET');
    if (userBet.choice !== game.winningOption) throw new Error('NOT_WINNER');
    const reward = ethers.BigNumber.from(game.totalPool).div(game.bets.length);
    return { txHash: '0x' + Math.random().toString(36).substring(2, 10), amount: reward.toString() };
  }

  async refund(params: { gameId: string; chainId: string }): Promise<{ txHash: string; amount: string }> {
    await this.delay(1000);
    const game = gamesStore[params.gameId];
    if (!game) throw new Error('GAME_NOT_EXIST');
    if (game.status !== 'EXPIRED') throw new Error('NOT_EXPIRED');
    const player = await this.getSignerAddress();
    const userBet = game.bets?.find((b: any) => b.player === player);
    if (!userBet) throw new Error('NO_BET');
    return { txHash: '0x' + Math.random().toString(36).substring(2, 10), amount: userBet.amount };
  }

  async getMessageStatus(params: { messageId: string }): Promise<{ status: string }> {
    const msg = messagesStore[params.messageId];
    if (!msg) return { status: 'not_found' };
    return { status: msg.status };
  }

  getCurrentChainId(): string {
    return this.chainId;
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private simulateMessageProgress(messageId: string) {
    let step = 0;
    const steps = ['pending', 'confirmed', 'signed', 'delivered'];
    const interval = setInterval(() => {
      step++;
      if (step < steps.length) {
        messagesStore[messageId].status = steps[step];
      } else {
        clearInterval(interval);
      }
    }, 3000);
  }
}