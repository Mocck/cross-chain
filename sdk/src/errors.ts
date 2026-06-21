import { ERROR_CODES } from './types';

export class CrossChainError extends Error {
  public code: number;
  public txHash?: string;

  constructor(code: number, message: string, txHash?: string) {
    super(message);
    this.name = 'CrossChainError';
    this.code = code;
    this.txHash = txHash;
  }
}