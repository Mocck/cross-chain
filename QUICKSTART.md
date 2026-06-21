# 跨链下注系统 - 快速启动指南

## 🚀 一键启动

### 方式 1：完整系统启动（推荐）

双击运行 `start-all.bat`，这个脚本会自动：

1. ✅ 启动 Hardhat 本地节点
2. ✅ 部署所有智能合约
3. ✅ 启动 Python Relayer 服务器
4. ✅ 测试系统健康状态

```bash
# 或者在命令行运行
start-all.bat
```

### 方式 2：仅启动 Relayer 服务器

如果 Hardhat 节点已经运行并且合约已部署：

```bash
cd relayer-python
start.bat
```

## 📋 手动启动步骤

### 1. 启动 Hardhat 节点

```bash
cd network
npx hardhat node
```

保持此终端运行。

### 2. 部署合约（新终端）

```bash
cd network
npx hardhat run scripts/deploy.js --network localhost
```

记下输出的合约地址。

### 3. 更新配置（如果需要）

编辑 `relayer-python/config.yaml` 和 `sdk/test-integration.ts`，更新合约地址。

### 4. 启动 Relayer（新终端）

```bash
cd relayer-python
python relayer_server.py
```

或者使用启动脚本：

```bash
cd relayer-python
start.bat
```

### 5. 运行测试（新终端）

```bash
cd sdk
npx ts-node test-integration.ts
```

## 🧪 验证系统运行

### 测试 Relayer API

```bash
# PowerShell
Invoke-RestMethod -Uri http://localhost:8080/api/v1/health

# 或者 curl
curl http://localhost:8080/api/v1/health
```

预期输出：
```json
{
  "code": 0,
  "message": "Relayer API is healthy",
  "data": {
    "timestamp": 1782038653,
    "version": "1.0.0",
    "backend": "Python/Flask"
  }
}
```

### 查询消息状态

```bash
curl http://localhost:8080/api/v1/message/0x<messageId>
```

## 🔧 环境要求

- **Node.js**: v16+ 
- **Python**: 3.8+ (Conda 环境: `stablediff`)
- **依赖**:
  - Python: `flask`, `pyyaml`, `web3`, `eth-account`
  - Node.js: `hardhat`, `ethers`, `typescript`

## 📂 目录结构

```
cross-chain/
├── start-all.bat              # 一键启动脚本
├── network/                   # 智能合约
│   ├── contracts/            # Solidity 合约
│   ├── scripts/deploy.js     # 部署脚本
│   └── hardhat.config.ts     # Hardhat 配置
├── relayer-python/           # Python Relayer
│   ├── start.bat            # Relayer 启动脚本
│   ├── config.yaml          # Relayer 配置
│   ├── relayer_server.py    # Flask API 服务器
│   ├── chain_adapter.py     # 区块链适配器
│   ├── event_listener.py    # 事件监听器
│   ├── message_signer.py    # EIP-712 签名器
│   └── message_relayer.py   # 消息中继器
└── sdk/                      # TypeScript SDK
    ├── src/index.ts         # SDK 主文件
    └── test-integration.ts  # 集成测试
```

## 🛠️ 故障排查

### Relayer 无法启动

1. 检查 Python 路径是否正确
2. 确认已安装所有依赖：`pip install flask pyyaml web3 eth-account`
3. 查看 `start.bat` 中的 `PYTHON_PATH` 配置

### 合约部署失败

1. 确认 Hardhat 节点正在运行
2. 检查端口 8545 是否被占用
3. 重启 Hardhat 节点

### API 无响应

1. 检查 Relayer 服务是否启动
2. 确认端口 8080 未被占用
3. 查看 Relayer 终端日志

## 📖 API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/v1/health` | GET | 健康检查 |
| `/api/v1/message/:messageId` | GET | 查询消息状态 |
| `/api/v1/message` | POST | 创建消息（测试用） |

## 📝 配置说明

### relayer-python/config.yaml

```yaml
networks:
  local_testnet:
    rpc_url: "http://127.0.0.1:8545"
    chain_id: 31337
    verifier_address: "0x..."     # MessageVerifier 地址
    bet_manager_address: "0x..."  # BetManager 地址
    settlement_manager_address: "0x..."  # SettlementManager 地址
    htlc_vault_address: "0x..."   # HTLCVault 地址

relayers:
  - "0xac0974..."  # Relayer 1 私钥
  - "0x59c699..."  # Relayer 2 私钥

threshold: 2  # 多签阈值

server:
  host: "0.0.0.0"
  port: 8080
```

## ✅ 测试结果示例

```
🚀 Cross-Chain Betting SDK - 集成测试

✅ 钱包已连接: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
✅ Relayer 健康检查: Relayer API is healthy

💰 发起跨链下注...
✅ 下注成功!
   BetID: 0x415de5ebda0db5b3e105318a279f55ca7a376829bbab577ab79bd536ce613e3c
   TxHash: 0x3d12ccd4bd962b4551d3da2b12afd9c855943dbc75c860338e7e77c4144e53bf

📊 查询下注信息...
✅ 下注详情:
   玩家: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
   金额: 0.1 ETH
   预测: 1
   回合ID: 1001
   状态: LOCKED
   超时时间: 2026/6/21 19:58:23

✅ 所有测试通过！
```

## 🎉 完成！

现在你可以：
1. 使用 SDK 发起跨链下注
2. 监控 Relayer 日志查看消息处理
3. 通过 API 查询消息状态
4. 开发自己的前端应用
