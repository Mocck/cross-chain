# 跨链竞猜系统 — 核心合约实现与技术文档


## 1. 跨链消息协议与核心合约代码

所有合约均基于 Solidity `^0.8.20` 编写，引入了 OpenZeppelin 的安全标准组件（如 `ECDSA`、`ReentrancyGuard`）来确保资金安全和防重放攻击。

接口与统一数据结构 (`ICrossChain.sol`)
跨链安全验证核心 (`MessageVerifier.sol`)
竞猜与状态机管理器 (`BetManager.sol`)
结算管理器 (`SettlementManager.sol`)
哈希锁定资金池 (`HTLCVault.sol`)


---

## 2. 合约单元测试用例 (`\test\CrossChainBetting.test.js`)

提供基于 **Hardhat (Ethers.js)** 的关键生命周期与安全矩阵测试脚本，覆盖了多签验证、状态机正确流转、异常超时退款及 HTLC 锁的完整分支。


---

## 3. 多链自动部署脚本与适配说明

为保障 Ethereum、Polygon 与 Arbitrum 组件架构对齐。通过配置统一的 `hardhat.config.js` 变量，依靠如下脚本实现动态初始化。

自动化部署脚本 为(`scripts/deploy.js`)


### 3.1 多链多适配（ChainAdapter）确认高度一览表

由于底层共识安全 Finality 不同，Relayer 监听各链事件时必须遵循以下规则：

| 链名称 (Chain) | EIP-155 ID | 建议安全确认区块高度 (Finality Blocks) | 状态获取方法原理 |
| --- | --- | --- | --- |
| **Ethereum Mainnet** | `1` | 2 Epochs (64 Blocks) | 接入 `finalized` 标签块高度校验 |
| **Arbitrum One** | `42161` | 1 Block (Sequencer 保证) | 通过 Rollup L2 Core 状态存证判定 |
| **Polygon PoS** | `137` | 32 Blocks | 监控 Heimdall 层节点 Checkpoint 最终性 |

---

## 4. 前端及 SDK 对接合约接口规范 (ABI Reference)

为方便 SDK 与前端工程师快速开发，提取了最核心的两个跨链读写函数定义及调用参数规范。

### 4.1 核心写入：跨链下注 (`placeBetCrossChain`)

* **函数签名**：`placeBetCrossChain(uint256 targetChainId, address receiverContract, uint8 prediction, uint256 roundId, uint256 timeoutDuration)`
* **携带 Value**：下注的 Native Token 数量 ($Wei$)。
* **SDK 调用示例 (ethers.js v6)**：

```typescript
import { ethers } from "ethers";

const betManagerABI = [
  "function placeBetCrossChain(uint256 targetChainId, address receiverContract, uint8 prediction, uint256 roundId, uint256 timeoutDuration) external payable returns (bytes32)"
];

const contract = new ethers.Contract(BET_MANAGER_ADDRESS, betManagerABI, signer);
const tx = await contract.placeBetCrossChain(
  137,                                      // 目标链为 Polygon
  "0xTargetSettlementContractAddress...",   // 结算链合约
  1,                                        // 选择选项 1 (例如：“是”)
  1001,                                     // 游戏竞猜轮次 ID
  3600,                                     // 1小时后未决则允许本地触发超时退款
  { value: ethers.parseEther("0.5") }       // 下注 0.5 ETH
);
const receipt = await tx.wait();
console.log("Tx Hash:", receipt.hash);

```

### 4.2 核心读取：查询单笔下注状态及属性 (`bets`)

* **函数签名**：`bets(bytes32 betId) -> (bytes32 betId, address player, uint256 amount, uint8 prediction, uint256 roundId, uint256 timeout, uint8 status)`
* **状态返回对照表**：`status` 返回值为整型枚举 ($0-4$)：

| 枚举值 (uint8) | 对应状态 (BetStatus) | 业务展现含义 |
| --- | --- | --- |
| **0** | `NONE` | 该下注 ID 不存在或非法。 |
| **1** | `LOCKED` | 已在源链锁定，正处于跨链 Relayer 状态流转中。 |
| **2** | `FINALIZED` | 结算链已产生胜负结果，本单游戏已终止计算。 |
| **3** | `CLAIMED` | 用户奖金已派发/提取完毕。 |
| **4** | `REFUNDED` | 系统发生跨链异常或超时，本金已被安全退回到用户钱包。 |

## 5. 运行测试

### 5.1  环境准备

在开始之前，请确保你的开发环境已安装以下基础工具：

- **Node.js** (推荐 v18 或以上)
- **Go** (推荐 v1.20 或以上，用于运行 Relayer)
- **Git**

### 5. 2 第一步：本地智能合约部署 (Hardhat)

首先，我们需要在本地启动一个模拟的区块链网络，并把规范中的 4 个核心合约部署上去。

#### 5. 2.1 安装依赖

进入项目的合约目录（假设为 `contracts/`），安装 OpenZeppelin 等核心依赖：

Bash

```
cd contracts
npm install --save-dev hardhat @openzeppelin/contracts dotenv
```

#### 5. 2.2 启动本地测试私有链

打开一个**独立的终端窗口**，运行以下命令启动 Hardhat 内置的本地以太坊节点（默认 Chain ID 为 `31337`）：

Bash

```
npx hardhat node
```

> **注意：** 启动后，终端会打印出 20 个测试账户的地址和私钥，请复制前几个私钥，后面配置 Relayer 和前端时需要用到。保持这个窗口不要关闭。

#### 5. 2.3 部署合约

打开一个新的终端窗口，运行规范中提供的部署脚本，将合约部署到刚才启动的本地网络中：

Bash

```
npx hardhat run scripts/deploy.js --network localhost
```

**运行成功后，控制台会输出四个合约的部署地址：**

- `MessageVerifier deployed at: 0x...`
- `BetManager deployed at: 0x...`
- `SettlementManager deployed at: 0x...`
- `HTLCVault deployed at: 0x...`

请记录下这些合约地址。

### 5. 3 第二步：运行多签 Relayer 服务 (Go)

Relayer 负责监听源链的事件（如 `BetCreatedCrossChain`），并在收集齐门限签名后，将消息推送到目标链。

#### 5. 3.1 配置文件

在 `relayer/` 目录下创建或修改配置文件（如 `config.yaml` 或 `.env`），填入刚才 Hardhat 部署得到的合约地址，以及测试网络节点的 RPC URL：

YAML

```
# config.yaml 示例
networks:
  local_testnet:
    rpc_url: "http://127.0.0.1:8545"
    chain_id: 31337
    verifier_address: "0x..." # 填入刚才部署的 MessageVerifier 地址
    bet_manager_address: "0x..." # 填入 BetManager 地址

relayers:
  # 填入部署脚本中预设的 Relayer 私钥（从 npx hardhat node 输出的私钥中复制）
  - "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  - "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"

threshold: 2
port: 8080
```

#### 5. 3.2 启动 Relayer API 服务

在 `relayer/` 目录执行以下命令，下载 Go 依赖并启动服务：

Bash

```
cd ../relayer
go mod tidy
go run main.go --config ./config.yaml
```

服务启动后，它会开始监听本地链上的跨链事件，同时在 `http://localhost:8080` 暴露本规范 §7 定义的 HTTP API。