# Cross-Chain Betting System

一个基于区块链的跨链下注系统，支持多链消息中继、EIP-712 签名验证和 HTLC 资金锁定。

## 🏗️ 系统架构

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Frontend  │─────▶│   SDK (TS)   │─────▶│   Relayer   │
│  (React/Vue)│      │              │      │  (Python)   │
└─────────────┘      └──────────────┘      └─────────────┘
                              │                     │
                              │                     │
                              ▼                     ▼
                     ┌─────────────────────────────────┐
                     │     Smart Contracts (Solidity)  │
                     │  • BetManager                   │
                     │  • MessageVerifier              │
                     │  • SettlementManager            │
                     │  • HTLCVault                    │
                     └─────────────────────────────────┘
```

## 🚀 快速启动

### 一键启动（推荐）

```bash
# Windows
start-all.bat

# 或手动运行
cd c:\Users\zhaow\Desktop\cross-chain
start-all.bat
```

这个脚本会自动：
1. ✅ 启动 Hardhat 本地节点 (端口 8545)
2. ✅ 部署所有智能合约
3. ✅ 启动 Python Relayer 服务器 (端口 8080)
4. ✅ 验证系统健康状态

### 验证系统运行

```bash
# 测试 Relayer API
curl http://localhost:8080/api/v1/health

# 运行 SDK 集成测试
cd sdk
npx ts-node test-integration.ts
```

## 📂 项目结构

```
cross-chain/
├── network/                    # 智能合约
│   ├── contracts/
│   │   ├── BetManager.sol     # 下注管理合约
│   │   ├── MessageVerifier.sol # 多签验证合约
│   │   ├── SettlementManager.sol # 结算合约
│   │   └── HTLCVault.sol      # HTLC 资金锁合约
│   ├── scripts/
│   │   └── deploy.js          # 部署脚本
│   └── hardhat.config.ts
│
├── relayer-python/            # Python Relayer 后端
│   ├── relayer_server.py     # Flask API 服务器
│   ├── chain_adapter.py      # 区块链适配器
│   ├── event_listener.py     # 事件监听器
│   ├── message_signer.py     # EIP-712 签名器
│   ├── message_relayer.py    # 消息中继器
│   ├── config.yaml           # 配置文件
│   ├── start.bat             # 启动脚本
│   └── abis/                 # 合约 ABI
│
├── sdk/                       # TypeScript SDK
│   ├── src/
│   │   └── index.ts          # SDK 主文件
│   ├── test-integration.ts   # 集成测试
│   └── package.json
│
├── frontend/                  # 前端应用（待开发）
├── start-all.bat             # 一键启动脚本
├── QUICKSTART.md             # 快速启动指南
└── README.md                 # 本文件
```

## 🔧 环境要求

- **Node.js**: v16+
- **Python**: 3.8+ (推荐使用 Conda 环境)
- **Git**: 最新版本

### Python 依赖

```bash
pip install flask pyyaml web3 eth-account
```

### Node.js 依赖

```bash
# 在 network/ 目录
npm install

# 在 sdk/ 目录
npm install
```

## 📖 详细文档

### 智能合约

#### BetManager
负责管理跨链下注的生命周期：
- `placeBetCrossChain()` - 发起跨链下注
- `finalizeBet()` - 结算下注
- `refundBet()` - 超时退款

#### MessageVerifier
实现 EIP-712 多签验证：
- 支持多个 Relayer 签名
- 可配置的签名阈值 (m-of-n)
- 防重放攻击机制

#### SettlementManager
处理跨链结算逻辑：
- 验证结算消息
- 计算赔付金额
- 触发资金分发

#### HTLCVault
哈希时间锁定合约：
- 支持大额资金跨链转移
- 原子性保证
- 超时自动退款

### Relayer API

#### 端点列表

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/v1/health` | GET | 健康检查 |
| `/api/v1/message/:messageId` | GET | 查询消息状态 |
| `/api/v1/message` | POST | 创建消息（测试用） |

#### 消息状态流转

```
PENDING → CONFIRMED → SIGNED → DELIVERED
   │                              │
   └──────────── FAILED ──────────┘
```

### SDK 使用示例

```typescript
import { CrossChainBettingSDK } from './sdk';

// 初始化 SDK
const sdk = new CrossChainBettingSDK({
  chains: {
    '31337': {
      chainId: '31337',
      rpcUrl: 'http://127.0.0.1:8545',
      betManagerAddress: '0x...',
      settlementManagerAddress: '0x...',
      verifierAddress: '0x...'
    }
  },
  relayerBaseUrl: 'http://localhost:8080'
});

// 连接钱包
const wallet = new ethers.Wallet(privateKey, provider);
sdk.connect(wallet);

// 发起跨链下注
const result = await sdk.placeBet({
  targetChainId: '31337',
  receiverContract: '0x...',
  prediction: 1,
  roundId: '1001',
  timeoutDuration: 3600,
  amount: '100000000000000000', // 0.1 ETH
  sourceChainId: '31337'
});

console.log('BetID:', result.betId);
console.log('TxHash:', result.txHash);

// 查询下注信息
const betInfo = await sdk.getBetInfo({
  betId: result.betId,
  chainId: '31337'
});

console.log('Status:', betInfo.status);
console.log('Wager:', betInfo.wager);
```

## 🧪 测试

### 运行集成测试

```bash
cd sdk
npx ts-node test-integration.ts
```

### 预期输出

```
🚀 Cross-Chain Betting SDK - 集成测试

✅ 钱包已连接: 0xf39Fd...
✅ Relayer 健康检查: Relayer API is healthy

💰 发起跨链下注...
✅ 下注成功!
   BetID: 0x415de...
   TxHash: 0x3d12c...

📊 查询下注信息...
✅ 下注详情:
   玩家: 0xf39Fd...
   金额: 0.1 ETH
   预测: 1
   回合ID: 1001
   状态: LOCKED

✅ 所有测试通过！
```

## 🔐 安全特性

- ✅ **EIP-712 签名** - 结构化数据签名，防止钓鱼攻击
- ✅ **多签验证** - 可配置的 m-of-n 多签机制
- ✅ **防重放攻击** - 消息 ID 去重
- ✅ **超时保护** - 自动退款机制
- ✅ **HTLC 原子性** - 跨链资金安全保证

## 🛠️ 配置

### Relayer 配置 (relayer-python/config.yaml)

```yaml
networks:
  local_testnet:
    rpc_url: "http://127.0.0.1:8545"
    chain_id: 31337
    verifier_address: "0x..."
    bet_manager_address: "0x..."
    settlement_manager_address: "0x..."
    htlc_vault_address: "0x..."

relayers:
  - "0xac0974..."  # Relayer 1 私钥
  - "0x59c699..."  # Relayer 2 私钥

threshold: 2  # 多签阈值

server:
  host: "0.0.0.0"
  port: 8080
```

## 🐛 故障排查

### Relayer 无法启动

1. 检查 Python 环境：`python --version`
2. 安装依赖：`pip install flask pyyaml web3 eth-account`
3. 检查配置文件：`relayer-python/config.yaml`

### 合约部署失败

1. 确认 Hardhat 节点正在运行
2. 检查端口 8545 是否可用
3. 重启节点：关闭终端窗口，重新运行 `start-all.bat`

### SDK 测试失败

1. 确认合约地址正确
2. 检查 Relayer 服务状态：`curl http://localhost:8080/api/v1/health`
3. 查看 Relayer 终端日志

## 📝 开发路线图

- [x] 智能合约开发
- [x] Python Relayer 实现
- [x] TypeScript SDK
- [x] 集成测试
- [ ] 前端应用
- [ ] 多链支持 (Ethereum, Polygon, BSC)
- [ ] 生产环境部署
- [ ] 监控和告警系统

## 👥 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🔗 相关链接

- [快速启动指南](./QUICKSTART.md)
- [合约文档](./network/README.md)
- [SDK 文档](./sdk/README.md)
- [Relayer 文档](./relayer-python/README.md)
