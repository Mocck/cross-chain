# 跨链竞猜系统 — 技术实现介绍

## 项目概述

基于 Relayer 模式的 EVM 跨链竞猜系统，支持用户在多条 EVM 兼容链上参与竞猜，由链下多签 relayer 网络负责跨链消息传递和结算。目前支持本地双链完整闭环，架构可扩展到任意 EVM 测试网。

## 技术架构

```
┌─────────┐     ┌──────────────────┐     ┌─────────┐
│ Chain A │     │  Relayer (8080)  │     │ Chain B │
│ :8545   │◄───►│                  │◄───►│ :8546   │
│         │     │  事件监听 ──► 签名 │     │         │
│ BetMgr  │     │  EIP-712 门限     │     │ BetMgr  │
│ Settle  │     │  跨链转发 ──► 执行 │     │ Settle  │
│ Verif   │     │                  │     │ Verif   │
└─────────┘     └──────────────────┘     └─────────┘
```

| 层 | 技术栈 | 目录 |
|----|-------|------|
| 合约层 | Solidity 0.8.28 + Hardhat | `network/` |
| 中继层 | Python + Flask + Web3.py | `relayer-python/` |
| SDK 层 | TypeScript + ethers v6 | `sdk/` |
| 前端 | React 19 + Vite 8 | `frontend/` |

## 已实现的核心技术

### 1. 双向跨链消息传递

两轮 relay 完成完整生命周期：

```
阶段一 (顺向):
  源链下注 → BetCreatedCrossChain 事件 → relayer 监听
  → EIP-712 签名 → SettlementManager.registerRoundFromCrossChain()

阶段二 (逆向):
  管理员开奖 → RoundFinished 事件 → relayer 监听
  → 按 roundId 检索关联 bet → 构造结算消息
  → EIP-712 签名 → BetManager.executeSettlement()
```

**证明**：relayer 日志完整输出两次 `delivered successfully`，分别对应 Chain B 的 `registerRoundFromCrossChain` 和 Chain A 的 `executeSettlement`。

### 2. 多签 Relayer 认证 (2-of-3)

| 配置项 | 值 |
|--------|-----|
| relayer 数量 | 3 (3 个独立私钥) |
| 门限值 | 2 (至少 2 个签名通过) |
| 签名标准 | EIP-712 结构化签名 |

```solidity
// 合约端验证
function verifyMessage(CrossChainMessage calldata message, bytes[] calldata signatures) {
    require(signatures.length >= threshold, "Insufficient signatures");
    for (uint i = 0; i < signatures.length; i++) {
        address signer = signHash.recover(signatures[i]);  // ECDSA 验签
        require(isRelayer[signer], "Invalid relayer");
        require(signer > lastSigner, "Must be sorted");     // 防重复
    }
    processedMessages[messageId] = true;  // 防重放
}
```

每条跨链消息需要 ≥2 个注册 relayer 的正确 EIP-712 签名才能在目标链上执行。

### 3. 防重放攻击

```solidity
mapping(bytes32 => bool) public processedMessages;
```

每条消息的 `messageId` 由 5 个字段组合哈希生成：

```
messageId = keccak256(sourceChainId, nonce, msgType, keccak256(data))
```

- `sourceChainId` + `nonce` — 保证每条消息全局唯一
- `msgType` — 同一条数据被当作不同类型的消息，ID 也不同
- `keccak256(data)` — 数据变了 ID 必变

链上 `processedMessages[id]` 标记为 true 后，永不可再执行。

### 4. ChainAdapter 统一多链接口

```python
# 链适配器：隐藏每条链的 RPC + 合约差异
adapter.get_web3("31337")                    # → Web3 实例
adapter.get_contract("31337", "bet_manager")  # → 合约实例
adapter.get_latest_block_number("31337")      # → 当前区块号
```

添加新链只需在 `config.yaml` 中新增一段配置，无需改代码。relayer 启动时自动为每条链创建 Web3 连接和合约实例，每条链独立线程监听事件。

### 5. 浏览器全流程验证

前端实现 6 步自动化轮询，无需手动操作：

```
[下注] → [跨链中] → [待开奖] → [开奖中] → [结算中] → [完成]
   ↓         ↓          ↓          ↓          ↓         ↓
 用户操作   3s轮询     自动检测    用户选择    3s轮询   显示结果
           bet状态    目标链round  获胜选项   bet状态
```

关键技术点：
- 前端通过 `useSDK()` 统一调用，不直接接触合约/RPC
- 自动 `evm_mine` 挖矿加速本地测试
- 每 3 秒轮询链上状态，自动推进步骤
- 动态链选择：下拉框显示所有已配置链

### 6. SDK 统一封装

```typescript
// 一行配置，屏蔽所有底层细节
const sdk = new CrossChainBettingSDK({
  chains: { '31337': { chainId, rpcUrl, betManagerAddress, ... } },
  relayerBaseUrl: 'http://localhost:8080'
});

sdk.connect(signer);       // 连钱包
const res = await sdk.placeBet({ sourceChainId, targetChainId, prediction, amount, ... });
const info = await sdk.getBetInfo({ betId, chainId });    // 查下注
const status = await sdk.getMessageStatus({ messageId }); // 查跨链状态
await sdk.waitForMessageDelivered(messageId);             // 等 relay 完成
```

SDK 封装了：ethers 合约调用、ABI 编码、事件解析、Relayer HTTP 查询、自动重试、结构化错误码。

### 7. 可扩展到多链网络

| 链 | Chain ID | 当前状态 |
|----|---------|---------|
| Hardhat Local A | 31337 | ✅ 已部署联调 |
| Hardhat Local B | 31338 | ✅ 已部署联调 |
| Sepolia | 11155111 | 🔧 配置就绪，待部署 |
| Polygon Amoy | 80002 | 🔧 配置就绪，待部署 |
| BSC Testnet | 97 | 🔧 配置就绪，待部署 |
| Arbitrum Sepolia | 421614 | 🔧 配置就绪，待部署 |

添加新链仅需三步：部署合约 → 填配置 → 重启 relayer。代码零改动。

## 安全机制

| 机制 | 实现 | 说明 |
|------|------|------|
| 防重放 | `processedMessages` mapping | 每条消息全局唯一ID，已处理即永久标记，不可重复执行 |
| 门限签名 | 2-of-3 EIP-712 多签 | 至少 2 个独立 relayer 签名才通过，单点私钥泄露无效 |
| 签名排序 | `signer > lastSigner` | 合约强制签名按地址递增排列，防止同一签名重复提交 |
| 超时退款 | `refundTimeoutBet()` | 跨链 relay 万一失败，超时后用户可自行取回资金 |
| 重入防护 | `ReentrancyGuard` | 退款/结算打 ETH 时加互斥锁，阻止递归攻击 |
| 资金锁定 | `msg.value` 直接锁入合约 | BetManager 接收下注即持有资金，结算/退款才释放 |
| 过期检查 | `timeout > block.timestamp` | 每条消息自带有效期，过期无法上链 |

## 技术栈总览

| 组件 | 核心技术 |
|------|---------|
| 智能合约 | Solidity 0.8.28, OpenZeppelin (ECDSA, ReentrancyGuard, Ownable), Hardhat + viem |
| Relayer | Python, Flask REST API, Web3.py v6, eth-account EIP-712, 多线程事件监听 |
| SDK | TypeScript, ethers v6, CJS/ESM 双构建 |
| 前端 | React 19, TypeScript 6, Vite 8, React Router 7 |
| 签名 | EIP-712 结构化签名, ECDSA 恢复, 门限签名 (m-of-n) |
| 安全 | 防重放映射, 签名排序去重, nonce 递增, 超时退款 |

## 跨链消息生命周期

```
事件产生 (1s)  →  block确认 (5s)  →  收集签名 (1s)  →  中继执行 (2s)
     │                  │                  │                 │
     └── 链上emit       └── 防重组         └── EIP-712       └── 目标链tx
                                                              Gas约 80k~100k
```

## 核心合约

| 合约 | 职责 | 关键函数 |
|------|------|---------|
| BetManager | 下注、结算、退款 | `placeBetCrossChain`, `executeSettlement`, `refundTimeoutBet` |
| SettlementManager | 注册 round、开奖 | `registerRoundFromCrossChain`, `finalizeRound` |
| MessageVerifier | 签名验证、防重放 | `verifyMessage`, `getEIP712SignHash` |

-----------------------------------------------------------------------------------------------

主流跨链就三种模式：

模式	怎么传消息	信任谁	速度	成本
Relayer (你现在)	链下程序签名转发	多数 relayer 诚实	快 (秒级)	低
轻客户端/桥	目标链运行源链共识验证	源链共识安全	慢 (分钟)	高
ZK 证明	ZK 证明源链状态	数学	快+安全	极高
