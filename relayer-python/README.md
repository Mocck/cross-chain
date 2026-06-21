# Cross-Chain Relayer (Python)

Python 实现的跨链消息中继服务，提供 HTTP API 与 SDK 对接。

## 📦 安装依赖

```bash
pip install flask pyyaml web3
```

## ⚙️ 配置文件

配置文件位于 `config.yaml`，包含以下部分：

### 1. 网络配置

```yaml
networks:
  local_testnet:
    rpc_url: "http://127.0.0.1:8545"
    chain_id: 31337
    verifier_address: "0x5FbDB2315678afecb367f032d93F642f64180aa3"
    bet_manager_address: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
    settlement_manager_address: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"
    htlc_vault_address: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"
```

支持配置多个网络，每个网络包含：
- `rpc_url`: JSON-RPC 节点地址
- `chain_id`: 链 ID
- `verifier_address`: MessageVerifier 合约地址
- `bet_manager_address`: BetManager 合约地址
- `settlement_manager_address`: SettlementManager 合约地址
- `htlc_vault_address`: HTLCVault 合约地址

### 2. Relayer 配置

```yaml
relayers:
  - "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  - "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
```

配置多个 Relayer 私钥，用于多签验证。

⚠️ **安全警告**：生产环境请使用环境变量或密钥管理服务，不要将私钥硬编码在配置文件中。

### 3. 多签阈值

```yaml
threshold: 2
```

指定多签验证所需的最小签名数量。必须满足：`threshold <= len(relayers)`

### 4. 确认块数

```yaml
required_confirmations: 12
```

链上事件需要的确认块数。

### 5. 服务器配置

```yaml
server:
  host: "0.0.0.0"
  port: 8080
```

- `host`: 监听地址（`0.0.0.0` 表示所有网卡）
- `port`: 监听端口

### 6. 日志配置

```yaml
logging:
  level: "INFO"  # DEBUG, INFO, WARNING, ERROR
```

## 🚀 启动服务

```bash
cd relayer-python
python relayer_server.py
```

启动成功后会显示：

```
====================================================
   Cross-Chain Relayer API Server (Python)
====================================================
✅ Config loaded from: /path/to/config.yaml
✅ Config validation passed
   Networks: 1
   Relayers: 2
   Threshold: 2/2
🚀 Starting server on http://0.0.0.0:8080
   Health: http://localhost:8080/api/v1/health
   Message: http://localhost:8080/api/v1/message/:messageId

📋 Configuration:
   Networks: ['local_testnet']
   Relayers: 2 configured
   Threshold: 2/2
   Required Confirmations: 12
====================================================
```

## 📡 API 端点

### 1. 健康检查

```bash
GET /api/v1/health
```

响应：
```json
{
  "code": 0,
  "message": "Relayer API is healthy",
  "data": {
    "timestamp": 1234567890,
    "version": "1.0.0",
    "backend": "Python/Flask"
  }
}
```

### 2. 查询消息状态

```bash
GET /api/v1/message/:messageId
```

响应：
```json
{
  "code": 0,
  "data": {
    "messageId": "0x...",
    "status": "delivered",
    "sourceChainId": "31337",
    "targetChainId": "31337",
    "msgType": 1,
    "confirmations": 12,
    "requiredConfirmations": 12,
    "signatures": 2,
    "requiredSignatures": 2,
    "createdAt": 1234567890,
    "deliveredAt": 1234567900,
    "txHash": "0x..."
  }
}
```

### 3. 创建消息（测试用）

```bash
POST /api/v1/message
Content-Type: application/json

{
  "messageId": "0x...",
  "sourceChainId": "31337",
  "targetChainId": "31337",
  "msgType": 1
}
```

## 🔧 配置验证

启动时会自动验证配置：

- ✅ 必需字段检查（networks, relayers, threshold, etc.）
- ✅ 网络配置完整性
- ✅ Relayer 数量检查
- ✅ 阈值合法性（threshold <= relayer count）

如果配置无效，服务会拒绝启动并显示错误信息。

## 📋 与 SDK 对接

SDK 配置示例：

```typescript
import { CrossChainBettingSDK } from './sdk';

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
  relayerBaseUrl: 'http://localhost:8080'  // 指向 Python Relayer
});
```

## 🆚 与 Go 版本对比

| 特性 | Go 版本 (relayer-done) | Python 版本 (relayer-python) |
|------|------------------------|------------------------------|
| 配置文件 | ✅ config.yaml | ✅ config.yaml |
| 多签支持 | ✅ | ✅ |
| 事件监听 | ✅ 完整实现 | 🚧 待实现 |
| 消息签名 | ✅ | 🚧 待实现 |
| 消息中继 | ✅ | 🚧 待实现 |
| HTTP API | ✅ | ✅ |

## 🚧 待完成功能

- [ ] Web3.py 集成（监听链上事件）
- [ ] 消息签名（使用 eth_account）
- [ ] 自动中继消息到目标链
- [ ] 数据库持久化（替代内存存储）
- [ ] 日志系统完善

## 🔐 安全建议

1. **私钥管理**：使用环境变量或 AWS Secrets Manager/HashiCorp Vault
2. **访问控制**：生产环境启用 API 认证（JWT/API Key）
3. **网络隔离**：Relayer 服务应部署在私有网络
4. **监控告警**：集成 Prometheus/Grafana 监控服务状态

## 📝 开发日志

- ✅ 2024-XX-XX: 创建配置文件系统
- ✅ 2024-XX-XX: 配置加载和验证
- ✅ 2024-XX-XX: HTTP API 基础实现
- 🚧 2024-XX-XX: Web3 事件监听（进行中）
