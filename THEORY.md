# 跨链竞猜系统 — 核心理论知识

## 1. 跨链的本质问题

两条独立的区块链**不互通**——没有任何原生机制能让链 A 知道链 B 发生了什么。所有跨链方案都在解决同一个问题：**如何在两条链之间安全地传递消息**。

```
Chain A (Ethereum)    ??    Chain B (Polygon)
     │                          │
     ├── 1000个节点               ├── 100个节点
     ├── 自己的状态树             ├── 自己的状态树
     └── 不知道 B 的任何事         └── 不知道 A 的任何事
```

三种主流方案：

| 方案 | 谁传递消息 | 信任假设 | 典型代表 |
|------|-----------|---------|---------|
| **Relayer 模式** | 链下中继器 | m-of-n 门限签名 | Chainlink CCIP, Wormhole (部分) |
| **轻客户端** | 源链区块头在目标链上验证 | 无信任 | Cosmos IBC, LayerZero |
| **ZK 证明** | ZK 证明在目标链上验证 | 无信任 | zkBridge, Succinct |

本项目用 **Relayer 模式**——最简单、最快、适合小规模应用。

## 2. Relayer 模式

### 核心思想

```
         ┌──────────────┐
Chain A  │   Relayer    │  Chain B
  ───────┤   (链下)      ├───────
  事件 ──►  监听 ──► 签名 ──►  合约调用
```

Relayer 是运行在链下的程序，它：
1. 监听链 A 的链上事件
2. 多个 relayer 各自独立验证事件合法性
3. 各自用私钥签名
4. 凑够阈值后，发交易到链 B 执行

### 为什么需要门限签名（m-of-n）

单个 relayer 私钥泄露 = 全完。门限签名把风险分散到 n 个独立保管的私钥，**必须 ≥m 个同时被攻破**才能伪造消息。

```
n=3, m=2 的配置：
  Relayer 1 签名 ─┐
  Relayer 2 签名 ─┼──→ 合约: 2/3 ≥ 阈值 → 通过
  Relayer 3 私钥泄露 → 他一个人签了没用，不够阈值
```

## 3. EIP-712 结构化签名

### 普通签名不够用

普通 `eth_sign`：用户看到一个哈希，不知道在签什么，容易被钓鱼。

```
钱包显示：签名 0x7f3a...9b2e
用户：这什么？  钓鱼者：快签！
用户：好的 （被钓）
```

### EIP-712 方案

构造结构化数据，让签名者对**可读的完整消息**签名：

```json
{
  "domain": { "name": "CrossChainBetting", "version": "1.0.0", "chainId": 31337 },
  "message": {
    "messageId": "0xabc...",
    "sourceChainId": 31337,
    "targetChainId": 31338,
    "sender": "0x...",
    "msgType": 0,
    "data": "0x..."
  }
}
```

**相当于在签一份带标题的合同，不只是一个哈希指纹。**

### 签名哈希计算（EIP-712 标准）

```
domainSeparator = keccak256(
  abi.encode(
    TYPEHASH("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
    keccak256("CrossChainBetting"),     // name hash
    keccak256("1.0.0"),                 // version hash
    chainId,                            // 区分链
    verifyingContract                   // 区分合约
  )
)

structHash = keccak256(
  abi.encode(
    TYPEHASH("CrossChainMessage(uint256 messageId,uint256 sourceChainId,uint256 targetChainId,address sender,address receiver,uint8 msgType,bytes data,uint256 timestamp,uint256 timeout)"),
    messageId, sourceChainId, targetChainId, sender, receiver, msgType,
    keccak256(data),   // 注意：bytes 类型先 hash 再放进 structHash
    timestamp, timeout
  )
)

signHash = keccak256(0x1901 || domainSeparator || structHash)
```

**关键：domainSeparator 包含 chainId，所以同一条消息在不同链上签名不同——天然防跨链重放。**

## 4. 消息防重放

区块链上任何人都可以重放历史交易。跨链消息更危险——同一个消息不能被执行两次。

### 本项目方案：processedMessages 映射

```solidity
mapping(bytes32 => bool) public processedMessages;

function verifyMessage(CrossChainMessage calldata message, ...) external returns (bool) {
    require(!processedMessages[bytes32(message.messageId)], "Message already processed");
    // ... 验证签名 ...
    processedMessages[bytes32(message.messageId)] = true;  // 标记已处理
}
```

messageId 设计确保唯一性：
```
messageId = keccak256(sourceChainId, nonce, msgType, keccak256(data))
             ───────────   ─────   ───────  ──────────────
             不同链不同ID    递增     区分类型    数据不同ID不同
```

## 5. 双阶段跨链结算

完整的一次下注需要两轮跨链消息：

### 第一阶段：下注 → 结算链通知
```
Chain A: lock ETH ──► relayer ──► Chain B: registerRound
  (bet 锁定)                         (知道有人下注了)
```

**作用**：让结算链知道"有个 round 里有 bet"，防止开奖后凭空捏造 bet。

### 第二阶段：开奖 ← 源链结算
```
admin: finalizeRound ──► Chain B: emit RoundFinished
                                ──► relayer ──► Chain A: executeSettlement
                                                  (赢家收钱)
```

**作用**：把开奖结果传回源链，触发资金释放。

### 为什么不能省掉第一阶段

如果有人先开奖，再下注（预测结果已知），就能稳赢。第一阶段确保 **bets 在开奖前已注册**，impossible to bet after knowing the result。

## 6. 跨链消息的原子性问题

当前实现：两个阶段**不原子**。如果第一阶段成功、第二阶段失败，bet 会永久卡在 LOCKED 状态。

解决方案：
- **超时退款**：BetManager 有 `refundTimeoutBet()`，用户在 timeout 后可取回
- **HTLC 原子交换**：HTLCVault 合约提供哈希时间锁，适合更严格的原子性需求

真正的跨链原子性方案（如 HTLC、Atomic Swap）不在当前流程中，是升级方向。

## 7. 一句总结

> Relayer 是链下信使，EIP-712 是防伪签名，门限签名分散信任，防重放映射阻止双花。两阶段消息交换完成锁定→通知→开奖→结算的信任最小化闭环。
