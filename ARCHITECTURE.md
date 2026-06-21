# 跨链竞猜系统 — Network & Relayer 架构说明

## 整体架构

```
┌─────────────────────┐          ┌─────────────────────┐
│   Chain A (31337)   │          │   Chain B (31338)   │
│   port 8545         │          │   port 8546         │
│                     │          │                     │
│  BetManager         │          │  BetManager         │
│  SettlementManager  │          │  SettlementManager  │
│  MessageVerifier    │          │  MessageVerifier    │
│  HTLCVault          │          │  HTLCVault          │
└─────────┬───────────┘          └──────────┬──────────┘
          │                                  │
          │    ┌──────────────────┐          │
          └───►│   Relayer (8080) │◄─────────┘
               │                  │
               │  event_listener  │ 监听两条链的事件
               │  message_signer  │ EIP-712 多签
               │  message_relayer │ 跨链转发交易
               └──────────────────┘
```

## 合约层 (network/) — 4 个核心合约

### 1. BetManager — 下注管理

| 功能 | 函数 | 说明 |
|------|------|------|
| 跨链下注 | `placeBetCrossChain(targetChainId, receiver, prediction, roundId, timeout)` | 用户调用，锁定 ETH，发射 `BetCreatedCrossChain` 事件 |
| 结算执行 | `executeSettlement(message, signatures)` | relayer 回传开奖结果，赢家双倍赔付 |
| 超时退款 | `refundTimeoutBet(betId)` | 超时后用户取回资金 |

**事件：**
- `BetCreatedCrossChain(bytes32 betId, address player, uint256 amount, uint256 targetChainId)` — relayer 入口

### 2. SettlementManager — 结算管理

| 功能 | 函数 | 说明 |
|------|------|------|
| 注册 Round | `registerRoundFromCrossChain(message, signatures)` | relayer 调用，验证签名后登记 round |
| 开奖 | `finalizeRound(roundId, result)` | 管理员调用，设定获胜选项 |

**事件：**
- `RoundFinished(uint256 roundId, uint8 result)` — relayer 回传入口

### 3. MessageVerifier — 签名验证

| 功能 | 函数 | 说明 |
|------|------|------|
| 验证签名 | `verifyMessage(message, signatures)` | EIP-712 多签验证，防重放 |
| EIP-712 哈希 | `getEIP712SignHash(message)` | 计算结构化签名哈希 |
| 防重放 | `processedMessages` mapping | 每条消息只处理一次 |

### 4. HTLCVault — 原子跨链转账（预留）

提供 `lock()` / `claim(secret)` / `refund()` 的哈希时间锁合约，用于需要原子交换的场景。当前流程未使用。

## Relayer (relayer-python/) — 5 个模块

### 完整消息流转

```
1. 用户下注 → BetManager.placeBetCrossChain() → emit BetCreatedCrossChain
                                    ↓
2. event_listener 轮询检测事件 → 读取合约详情(betId,roundId,prediction...)
                                    ↓
3. 构造 CrossChainMessage → 10 个字段，包括
   - messageId: keccak256(sourceChainId, nonce, msgType, keccak(data))
   - data: abi.encode(betId, player, amount, roundId)
   - msgType: 0 = BET_CREATED
                                    ↓
4. 等待 1 个区块确认 → status: 'confirmed'
                                    ↓
5. message_signer EIP-712 签名 (2-of-2 门限)
   domain: CrossChainBetting v1.0.0 chainId=V  verifyingContract=Verifier合约地址
   struct: CrossChainMessage 9个字段
                                    ↓
6. message_relayer 发交易到目标链
   - msgType=0 → SettlementManager.registerRoundFromCrossChain()
   - msgType=1 → BetManager.executeSettlement()
                                    ↓
7. 目标链验证签名 → 执行 → 状态更新
```

### event_listener.py — 事件监听

- 为每条链启动独立线程，每 5 秒轮询新区块
- 监听 `BetCreatedCrossChain`（BetManager）— 下注事件
- 监听 `RoundFinished`（SettlementManager）— 开奖事件
- 从合约查询 bet 详情（roundId, prediction, timeout）
- 构造标准 `CrossChainMessage` 存入 MessageStore

### message_signer.py — 多签引擎

- `MessageSigner`：单链 EIP-712 签名器
- `MultiChainSigner`：管理多条链各自的 signer（不同 chainId → 不同 domain separator）
- 签名按地址排序（合约要求严格递增）
- 使用 `eth_account` 内置 EIP-712 编码，与 Solidity 合约一致

### message_relayer.py — 消息转发

- 每 5 秒处理所有 pending 消息
- 确认 → 签名 → 中继 三阶段流水线
- 按 msgType 路由：
  - `0 (BET_CREATED)` → SettlementManager.registerRoundFromCrossChain()
  - `1 (ROUND_RESULT)` → BetManager.executeSettlement()
- 签名用目标链的 verifier domain

### relayer_server.py — HTTP API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/v1/health` | GET | 健康检查 |
| `/api/v1/message/:id` | GET | 查询消息状态 (pending/confirmed/signed/delivered) |
| `/api/v1/message` | POST | 创建测试消息 |

### chain_adapter.py — 多链适配

- Web3 连接池：每条链一个 Web3 实例
- 合约加载：BetManager / SettlementManager / Verifier
- 统一接口：`get_web3(chainId)` / `get_contract(chainId, name)`

## 双链跨链闭合流程

```
┌─────────────────────────────────────────────────────────┐
│ 阶段 1: 下注 + 跨链注册                                    │
│                                                         │
│ Chain A: placeBetCrossChain(msg.value=0.1ETH)           │
│   → emit BetCreatedCrossChain(betId, player, targetId)  │
│   → bet status = LOCKED, 资金锁定                        │
│                                                         │
│ Relayer: 监听 → 查询详情 → 构造消息 → EIP-712签名         │
│   → 发交易到 Chain B                                     │
│                                                         │
│ Chain B: registerRoundFromCrossChain()                  │
│   → rounds[roundId] 已注册，等待开奖                      │
├─────────────────────────────────────────────────────────┤
│ 阶段 2: 开奖 + 结算回传（反向）                             │
│                                                         │
│ 管理员: finalizeRound(roundId, winnerOption)             │
│   → emit RoundFinished(roundId, result)                 │
│                                                         │
│ Relayer: 监听 RoundFinished → 按 roundId 查所有 bet      │
│   → 构造结算消息(msgType=1)→ EIP-712签名 → 回传 Chain A   │
│                                                         │
│ Chain A: executeSettlement(message, signatures)          │
│   → 预测正确: 双倍赔付, status=CLAIMED                    │
│   → 预测错误: 资金归平台, status=FINALIZED                 │
└─────────────────────────────────────────────────────────┘
```

## 多链支持

| 链 | Chain ID | 状态 |
|----|---------|------|
| Hardhat A | 31337 | 本地已部署 |
| Hardhat B | 31338 | 本地已部署 |
| Sepolia | 11155111 | 待部署+填地址 |
| Polygon Amoy | 80002 | 待部署+填地址 |
| BSC Testnet | 97 | 待部署+填地址 |
| Arbitrum Sepolia | 421614 | 待部署+填地址 |

添加新链只需：
1. `hardhat.config.ts` 加网络配置（RPC + 私钥）
2. `npx hardhat run scripts/deploy.js --network <name>`
3. 把部署地址填入 relayer `config.yaml` 和 SDK `ALL_CHAINS`

## 关键安全机制

| 机制 | 实现 | 位置 |
|------|------|------|
| 防重放 | `processedMessages` mapping | MessageVerifier.sol |
| 门限签名 | n-of-m 多签 | message_signer.py |
| EIP-712 | 结构化签名哈希 | MessageVerifier.sol + message_signer.py |
| 超时退款 | `refundTimeoutBet()` | BetManager.sol |
| 资金安全 | ReentrancyGuard | BetManager.sol |
