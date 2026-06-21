# Cross-Chain Betting SDK - 使用指南

## 📦 安装

```bash
cd sdk
npm install
npm run build
```

## 🚀 快速开始

### 1. 基础配置

```typescript
import { CrossChainBettingSDK, LogLevel } from './src/index';
import { LOCAL_CONFIG } from './src/config.example';
import { ethers } from 'ethers';

// 创建 SDK 实例
const sdk = new CrossChainBettingSDK(LOCAL_CONFIG, LogLevel.INFO);

// 连接钱包
const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();
sdk.connect(signer);
```

### 2. 下注

```typescript
// 跨链下注
const result = await sdk.placeBet({
  sourceChainId: '31337',        // 源链
  targetChainId: '31337',        // 目标链（结算链）
  receiverContract: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0', // SettlementManager 地址
  prediction: 1,                 // 预测结果 (0, 1, 2, ...)
  roundId: '1001',               // 回合ID
  timeoutDuration: 3600,         // 超时时间（秒）
  amount: ethers.parseEther('0.1').toString() // 下注金额
});

console.log('BetID:', result.betId);
console.log('TxHash:', result.txHash);
```

### 3. 查询下注信息

```typescript
const betInfo = await sdk.getBetInfo({
  betId: '0x123...', // 从 placeBet 返回的 betId
  chainId: '31337'
});

console.log('Player:', betInfo.player);
console.log('Amount:', betInfo.amount);
console.log('Status:', betInfo.status); // 0=NONE, 1=LOCKED, 2=FINALIZED, 3=CLAIMED, 4=REFUNDED
console.log('Prediction:', betInfo.prediction);
console.log('Timeout:', new Date(betInfo.timeout * 1000));
```

### 4. 超时退款

```typescript
try {
  const refundResult = await sdk.refund({
    betId: '0x123...',
    chainId: '31337'
  });
  
  console.log('Refunded:', ethers.formatEther(refundResult.amount), 'ETH');
  console.log('TxHash:', refundResult.txHash);
} catch (error) {
  if (error.code === ERROR_CODES.BET_EXPIRED) {
    console.log('Bet has not timed out yet');
  }
}
```

### 5. 查询跨链消息状态（需要 Relayer 运行）

```typescript
// 查询消息状态
const messageStatus = await sdk.getMessageStatus({
  messageId: '0xabc...'
});

console.log('Status:', messageStatus.status); // pending, confirmed, signed, delivered, failed
console.log('Confirmations:', messageStatus.confirmations);
console.log('Signatures:', messageStatus.signatures);

// 或者等待消息完成
try {
  const finalStatus = await sdk.waitForMessageDelivered(
    '0xabc...',
    3000,  // 轮询间隔 3秒
    300000 // 超时 5分钟
  );
  console.log('Message delivered!', finalStatus);
} catch (error) {
  console.error('Message delivery failed or timed out');
}
```

## 📋 完整示例

```typescript
import { CrossChainBettingSDK, BetStatus, LogLevel } from './sdk';
import { ethers } from 'ethers';

async function main() {
  // 1. 初始化 SDK
  const sdk = new CrossChainBettingSDK({
    chains: {
      '31337': {
        chainId: '31337',
        rpcUrl: 'http://127.0.0.1:8545',
        betManagerAddress: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
        settlementManagerAddress: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
        verifierAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3'
      }
    },
    relayerBaseUrl: 'http://localhost:8080'
  }, LogLevel.DEBUG);

  // 2. 连接钱包
  const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
  const wallet = new ethers.Wallet('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', provider);
  sdk.connect(wallet);

  // 3. 下注
  console.log('Placing bet...');
  const betResult = await sdk.placeBet({
    sourceChainId: '31337',
    targetChainId: '31337',
    receiverContract: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    prediction: 1,
    roundId: '1001',
    timeoutDuration: 3600,
    amount: ethers.parseEther('0.1').toString()
  });
  
  console.log('✅ Bet placed!');
  console.log('BetID:', betResult.betId);
  console.log('TxHash:', betResult.txHash);

  // 4. 查询下注信息
  const betInfo = await sdk.getBetInfo({
    betId: betResult.betId,
    chainId: '31337'
  });
  
  console.log('\n📊 Bet Info:');
  console.log('Player:', betInfo.player);
  console.log('Amount:', ethers.formatEther(betInfo.amount), 'ETH');
  console.log('Status:', BetStatus[betInfo.status]);
  console.log('Prediction:', betInfo.prediction);
  console.log('Round ID:', betInfo.roundId);
}

main().catch(console.error);
```

## 🔧 BetStatus 枚举

```typescript
enum BetStatus {
  NONE = 0,        // 不存在
  LOCKED = 1,      // 已锁定（等待结算）
  FINALIZED = 2,   // 已结算
  CLAIMED = 3,     // 已领取
  REFUNDED = 4     // 已退款
}
```

## ⚠️ 注意事项

1. **Relayer 依赖**
   - `getMessageStatus()` 和 `waitForMessageDelivered()` 需要 Relayer 运行
   - 如果 Relayer 未启动，这些方法会抛出异常

2. **超时退款条件**
   - 只有状态为 `LOCKED` 的 bet 才能退款
   - 必须超过 `timeout` 时间才能退款

3. **金额单位**
   - 所有金额使用 **wei** 单位
   - 使用 `ethers.parseEther()` 转换

4. **链ID格式**
   - 使用字符串格式：`'31337'`, `'11155111'`
   - 不要使用数字

## 🚀 下一步

- 实现 Relayer 服务
- 部署到测试网
- 集成到 Frontend
