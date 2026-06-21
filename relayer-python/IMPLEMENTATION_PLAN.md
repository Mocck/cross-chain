# Relayer 核心功能实现计划

## 🎯 目标
实现完整的跨链消息中继功能，包括事件监听、消息签名、跨链中继。

## 📋 实现步骤

### 1️⃣ Web3.py 集成
- [x] 配置文件已有 RPC URL 和合约地址
- [ ] 创建 Web3 连接池
- [ ] 加载合约 ABI
- [ ] 创建合约实例

### 2️⃣ 事件监听
- [ ] 监听 BetManager.BetCreatedCrossChain 事件
- [ ] 解析事件参数：
  - betId
  - messageId  
  - player
  - targetChainId
  - amount
- [ ] 保存到消息存储
- [ ] 等待确认块数

### 3️⃣ 消息签名
- [ ] 使用 eth_account 加载私钥
- [ ] 构造签名消息格式（EIP-712 或 keccak256）
- [ ] 多个 Relayer 独立签名
- [ ] 收集签名直到达到 threshold
- [ ] 更新消息状态为 SIGNED

### 4️⃣ 消息中继
- [ ] 构造 verifyMessage() 调用
- [ ] 提交签名数组
- [ ] 发送交易到目标链
- [ ] 等待交易确认
- [ ] 更新消息状态为 DELIVERED

## 🔧 技术细节

### 合约 ABI 需求
- BetManager: BetCreatedCrossChain 事件
- MessageVerifier: verifyMessage() 方法

### 签名格式
需要查看 MessageVerifier.sol 的签名验证逻辑，确定：
- 签名消息格式（messageId? 还是完整消息？）
- 签名算法（eth_sign? EIP-712?）

### 多签协调
- 方案1: 每个 Relayer 独立运行，签名存储在链下
- 方案2: 使用共享数据库/Redis 协调签名
- 当前实现: 简化版 - 单个 Relayer 进程内模拟多签

## 📝 文件结构
```
relayer-python/
├── relayer_server.py      # Flask API 服务器
├── config.yaml            # 配置文件
├── chain_adapter.py       # NEW: Web3 链适配器
├── event_listener.py      # NEW: 事件监听器
├── message_signer.py      # NEW: 消息签名器
├── message_relayer.py     # NEW: 消息中继器
└── abis/                  # NEW: 合约 ABI
    ├── BetManager.json
    ├── MessageVerifier.json
    └── SettlementManager.json
```
