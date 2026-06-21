import { RelayerMessageResponse } from './types';

export class RelayerClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async getMessageStatus(messageId: string): Promise<RelayerMessageResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/message/${messageId}`);
    const result = await response.json();
    
    if (result.code !== 0) {
      throw new Error(result.message || 'Failed to fetch message status');
    }
    return result.data;
  }
}