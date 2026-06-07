# 跨链竞猜系统 — 统一接口定义规范 v1.0
---

## 目录

1. [跨链消息结构体](#1-跨链消息结构体-crosschainmessage)
2. [消息类型枚举](#2-消息类型枚举)
3. [业务数据格式](#3-业务数据格式)
4. [错误码体系](#4-错误码体系)
5. [合约事件定义](#5-合约事件定义)
6. [合约函数接口](#6-合约函数接口)
7. [Relayer API](#7-relayer-api)
8. [SDK 接口](#8-sdk-接口)
9. [哈希计算规则](#9-哈希计算规则)
10. [签名与验证规则](#10-签名与验证规则)

---

## 1. 跨链消息结构体 (CrossChainMessage)

> **这是全项目最重要的数据结构**。合约、Relayer、SDK 三端的定义必须逐字段完全一致。

### 1.1 结构体定义

| # | 字段 | 类型 | 说明 | 必填 |
|---|------|------|------|------|
| 1 | `messageId` | `uint256` / `*big.Int` | 全局唯一消息ID = `keccak256(sourceChainId, nonce, msgType, data)` | ✅ |
| 2 | `sourceChainId` | `uint256` / `*big.Int` | 源链 EIP-155 Chain ID | ✅ |
| 3 | `targetChainId` | `uint256` / `*big.Int` | 目标链 EIP-155 Chain ID | ✅ |
| 4 | `sender` | `address` / `common.Address` | 发送者地址 | ✅ |
| 5 | `receiver` | `address` / `common.Address` | 接收者地址 | ✅ |
| 6 | `msgType` | `uint8` | 消息类型 (见 §2 枚举) | ✅ |
| 7 | `data` | `bytes` / `[]byte` | 业务数据 (ABI编码, 见 §3) | ✅ |
| 8 | `timestamp` | `uint256` / `uint64` | 消息创建时间 (unix秒) | ✅ |
| 9 | `timeout` | `uint256` / `uint64` | 超时区块高度或时间戳 | ✅ |
| 10 | `signature` | `bytes` / `[]byte` | 签名数据 (多签时拼接) | ❌ 可选 |

### 1.2 Solidity 定义

```solidity
// FILE: contracts/interfaces/ICrossChainMessage.sol
// 全项目统一：CrossChainMessage 结构体

pragma solidity ^0.8.20;

struct CrossChainMessage {
    uint256 messageId;      // 全局唯一消息ID（防重放）
    uint256 sourceChainId;  // 源链ID
    uint256 targetChainId;  // 目标链ID
    address sender;         // 发送者地址
    address receiver;       // 接收者地址
    uint8 msgType;          // 消息类型（1=下注, 2=开奖, 3=索赔, 4=退款）
    bytes data;             // 业务数据（ABI编码）
    uint256 timestamp;      // 时间戳
    uint256 timeout;        // 超时高度/时间
    bytes signature;        // 签名（可选，传递时可有可无）
}
```

### 1.3 Go 定义

```go
// FILE: relayer/pkg/types/message.go

type CrossChainMessage struct {
    MessageID     common.Hash     `json:"messageId"`     // 全局唯一消息ID
    SourceChainID *big.Int        `json:"sourceChainId"` // 源链ID
    TargetChainID *big.Int        `json:"targetChainId"` // 目标链ID
    Sender        common.Address  `json:"sender"`        // 发送者地址
    Receiver      common.Address  `json:"receiver"`      // 接收者地址
    MsgType       uint8           `json:"msgType"`       // 消息类型
    Data          hexutil.Bytes   `json:"data"`          // 业务数据
    Timestamp     uint64          `json:"timestamp"`     // 时间戳
    Timeout       uint64          `json:"timeout"`       // 超时
    Signature     hexutil.Bytes   `json:"signature,omitempty"` // 签名
}
```

### 1.4 TypeScript 定义 (SDK)

```typescript
// FILE: sdk/src/types.ts

export interface CrossChainMessage {
  messageId: string;        // hex string
  sourceChainId: string;    // decimal string
  targetChainId: string;    // decimal string
  sender: string;           // hex address
  receiver: string;         // hex address
  msgType: number;          // 1|2|3|4
  data: string;             // hex string
  timestamp: number;
  timeout: number;
  signature?: string;       // hex string, optional
}
```

### 1.5 messageId 生成规则

> **三端必须使用完全相同的算法生成 messageId**

```text
messageId = keccak256(
    abi.encodePacked(sourceChainId, nonce, msgType, keccak256(data))
)
```

| 端 | 实现 |
|----|------|
| Solidity | `keccak256(abi.encodePacked(sourceChainId, nonce, msgType, keccak256(data)))` |
| Go | `crypto.Keccak256Hash(common.LeftPadBytes(sourceChainId.Bytes(),32), ...)` |
| TS | `ethers.solidityPackedKeccak256(...)` |

---

## 2. 消息类型枚举

> **所有模块使用相同的 uint8 值**，禁止使用 bytes32/keccak256 哈希作为消息类型。

| 常量名 | 值 | 说明 | 方向 |
|--------|----|------|------|
| `MSG_TYPE_BET` | `1` | 下注消息 | 任意链 → 任意链 |
| `MSG_TYPE_RESULT` | `2` | 开奖结果消息 | 结果链 → 其他链 |
| `MSG_TYPE_CLAIM` | `3` | 索赔/领奖消息 | 领奖链 → 其他链 |
| `MSG_TYPE_REFUND` | `4` | 退款消息 | 退款链 → 其他链 |

### 2.1 Solidity

```solidity
// FILE: contracts/interfaces/ICrossChainMessage.sol

uint8 constant MSG_TYPE_BET    = 1;
uint8 constant MSG_TYPE_RESULT = 2;
uint8 constant MSG_TYPE_CLAIM  = 3;
uint8 constant MSG_TYPE_REFUND = 4;
```

### 2.2 Go

```go
// FILE: relayer/pkg/types/message.go

const (
    MsgTypeBet    uint8 = 1
    MsgTypeResult uint8 = 2
    MsgTypeClaim  uint8 = 3
    MsgTypeRefund uint8 = 4
)
```

### 2.3 TypeScript

```typescript
// FILE: sdk/src/types.ts

export const MSG_TYPE = {
  BET:    1,
  RESULT: 2,
  CLAIM:  3,
  REFUND: 4,
} as const;
```

---

## 3. 业务数据格式

> `data` 字段使用 **Solidity ABI编码** 作为序列化格式，Go/TS 端使用对应的 ABI 库进行编解码。

### 3.1 下注消息 (msgType=1)

```solidity
// Solidity 编码
abi.encode(
    gameId,         // uint256 - 游戏ID
    player,         // address - 玩家地址
    amount,         // uint256 - 下注金额(wei)
    choice,         // uint8   - 选择的选项索引
    chainId         // uint256 - 下注所在链ID
)
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `gameId` | `uint256` | 游戏ID |
| `player` | `address` | 玩家地址 |
| `amount` | `uint256` | 下注金额 (wei) |
| `choice` | `uint8` | 选择的选项索引 (0-based) |
| `chainId` | `uint256` | 下注所在链ID |

### 3.2 开奖消息 (msgType=2)

```solidity
// Solidity 编码
abi.encode(
    gameId,         // uint256 - 游戏ID
    result,         // uint8   - 获胜选项索引
    totalPool,      // uint256 - 总奖池(wei)
    timestamp       // uint256 - 开奖时间(unix秒)
)
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `gameId` | `uint256` | 游戏ID |
| `result` | `uint8` | 获胜选项索引 |
| `totalPool` | `uint256` | 总奖池 (wei) |
| `timestamp` | `uint256` | 开奖时间 |

### 3.3 索赔消息 (msgType=3)

```solidity
// Solidity 编码
abi.encode(
    gameId,         // uint256 - 游戏ID
    player,         // address - 玩家地址
    amount,         // uint256 - 索赔金额(wei)
    claimId         // uint256 - 索赔记录ID
)
```

### 3.4 退款消息 (msgType=4)

```solidity
// Solidity 编码
abi.encode(
    gameId,         // uint256 - 游戏ID
    player,         // address - 玩家地址
    amount,         // uint256 - 退款金额(wei)
    reason          // uint8   - 退款原因(1=超时, 2=取消)
)
```

### 3.5 Go 解码示例

```go
// FILE: relayer/pkg/types/payload.go

// 解码下注消息
func DecodeBetPayload(data []byte) (*BetPayload, error) {
    args := abi.Arguments{
        {Type: abi.Type{T: abi.UintTy, Size: 256}}, // gameId
        {Type: abi.Type{T: abi.AddressTy}},           // player
        {Type: abi.Type{T: abi.UintTy, Size: 256}}, // amount
        {Type: abi.Type{T: abi.UintTy, Size: 8}},   // choice
        {Type: abi.Type{T: abi.UintTy, Size: 256}}, // chainId
    }
    decoded, err := args.Unpack(data)
    // ...
}
```

---

## 4. 错误码体系

> **所有模块返回相同的错误码**。前端根据错误码显示对应文案。

### 4.1 通用错误 (1000-1999)

| 错误码 | 常量名 | 说明 |
|--------|--------|------|
| `0` | `ERROR_SUCCESS` | 成功 |
| `1001` | `ERROR_INVALID_SIGNATURE` | 签名无效 |
| `1002` | `ERROR_MESSAGE_EXPIRED` | 消息已过期 |
| `1003` | `ERROR_DUPLICATE_MESSAGE` | 消息重复 |
| `1004` | `ERROR_INVALID_NONCE` | Nonce无效 |
| `1005` | `ERROR_WRONG_CHAIN` | 目标链错误 |

### 4.2 游戏错误 (2000-2999)

| 错误码 | 常量名 | 说明 |
|--------|--------|------|
| `2001` | `ERROR_GAME_NOT_EXIST` | 游戏不存在 |
| `2002` | `ERROR_BET_CLOSED` | 下注已关闭 |
| `2003` | `ERROR_GAME_RESOLVED` | 游戏已揭晓 |
| `2004` | `ERROR_GAME_EXPIRED` | 游戏已过期 |
| `2005` | `ERROR_ALREADY_CLAIMED` | 已领取过奖励 |

### 4.3 Relayer错误 (3000-3999)

| 错误码 | 常量名 | 说明 |
|--------|--------|------|
| `3001` | `ERROR_RELAYER_FAILED` | Relayer处理失败 |
| `3002` | `ERROR_RELAYER_NOT_FOUND` | Relayer未找到 |
| `3003` | `ERROR_THRESHOLD_NOT_MET` | 签名数量不足 |

### 4.4 资金错误 (4000-4999)

| 错误码 | 常量名 | 说明 |
|--------|--------|------|
| `4001` | `ERROR_INSUFFICIENT_FUNDS` | 资金不足 |
| `4002` | `ERROR_LOCK_NOT_FOUND` | 锁定记录不存在 |
| `4003` | `ERROR_LOCK_EXPIRED` | 锁定期已过 |
| `4004` | `ERROR_REFUND_FAILED` | 退款失败 |

### 4.5 三端定义

```solidity
// Solidity: contracts/libraries/ErrorCodes.sol
library ErrorCodes {
    uint16 constant SUCCESS               = 0;
    uint16 constant INVALID_SIGNATURE     = 1001;
    uint16 constant MESSAGE_EXPIRED       = 1002;
    uint16 constant DUPLICATE_MESSAGE     = 1003;
    uint16 constant INVALID_NONCE         = 1004;
    uint16 constant WRONG_CHAIN           = 1005;
    uint16 constant GAME_NOT_EXIST        = 2001;
    uint16 constant BET_CLOSED            = 2002;
    uint16 constant GAME_RESOLVED         = 2003;
    uint16 constant GAME_EXPIRED          = 2004;
    uint16 constant ALREADY_CLAIMED       = 2005;
    uint16 constant RELAYER_FAILED        = 3001;
    uint16 constant RELAYER_NOT_FOUND     = 3002;
    uint16 constant THRESHOLD_NOT_MET     = 3003;
    uint16 constant INSUFFICIENT_FUNDS    = 4001;
    uint16 constant LOCK_NOT_FOUND        = 4002;
    uint16 constant LOCK_EXPIRED          = 4003;
    uint16 constant REFUND_FAILED         = 4004;
}
```

```go
// Go: relayer/pkg/types/errors.go
const (
    ErrSuccess            uint16 = 0
    ErrInvalidSignature   uint16 = 1001
    ErrMessageExpired     uint16 = 1002
    ErrDuplicateMessage   uint16 = 1003
    // ... 完整对照
)
```

```typescript
// TypeScript: sdk/src/errors.ts
export const ERROR = {
  SUCCESS:              0,
  INVALID_SIGNATURE:    1001,
  MESSAGE_EXPIRED:      1002,
  // ... 完整对照
} as const;
```

---

## 5. 合约事件定义

> **合约事件是 Relayer 的数据入口**。事件名称、字段、索引必须固定。

### 5.1 BetCreated

```solidity
event BetCreated(
    uint256 indexed gameId,
    address indexed creator,
    string question,
    string[] options,
    uint256 deadline,
    uint256 chainId
);
```

### 5.2 BetPlaced

```solidity
event BetPlaced(
    uint256 indexed gameId,
    address indexed player,
    uint256 amount,
    uint8 choice,
    uint256 chainId
);
```

### 5.3 ResultSubmitted

```solidity
event ResultSubmitted(
    uint256 indexed gameId,
    uint8 winningOption,
    uint256 totalPool,
    uint256 timestamp
);
```

### 5.4 PrizeClaimed

```solidity
event PrizeClaimed(
    uint256 indexed gameId,
    address indexed player,
    uint256 amount,
    uint256 claimId
);
```

### 5.5 RefundProcessed

```solidity
event RefundProcessed(
    uint256 indexed gameId,
    address indexed player,
    uint256 amount,
    uint8 reason
);
```

### 5.6 MessageReceived (跨链消息到达)

```solidity
event MessageReceived(
    bytes32 indexed messageId,
    uint8 indexed msgType,
    address indexed relayer,
    uint256 sourceChainId,
    uint256 targetChainId
);
```

### 5.7 事件签名表 (Relayer用)

| 事件名 | 事件签名 | keccak256 |
|--------|---------|-----------|
| BetCreated | `BetCreated(uint256,address,string,string[],uint256,uint256)` | `0x...` |
| BetPlaced | `BetPlaced(uint256,address,uint256,uint8,uint256)` | `0x...` |
| ResultSubmitted | `ResultSubmitted(uint256,uint8,uint256,uint256)` | `0x...` |
| PrizeClaimed | `PrizeClaimed(uint256,address,uint256,uint256)` | `0x...` |
| RefundProcessed | `RefundProcessed(uint256,address,uint256,uint8)` | `0x...` |
| MessageReceived | `MessageReceived(bytes32,uint8,address,uint256,uint256)` | `0x...` |

---

## 6. 合约函数接口

### 6.1 BetManager

```solidity
interface IBetManager {
    /// 创建竞猜
    function createGame(
        string calldata question,
        string[] calldata options,
        uint256 deadline
    ) external returns (uint256 gameId);

    /// 下注
    function placeBet(
        uint256 gameId,
        uint8 choice
    ) external payable;

    /// 获取游戏信息
    function getGameInfo(uint256 gameId)
        external view returns (
            string question,
            string[] options,
            uint256 deadline,
            uint256 totalPool,
            uint8 status,
            address creator
        );

    /// 领奖
    function claimReward(uint256 gameId) external;

    /// 退款（超时/取消）
    function refund(uint256 gameId) external;
}
```

### 6.2 MessageVerifier

```solidity
interface IMessageVerifier {
    /// 验证并处理跨链消息
    function verifyMessage(
        CrossChainMessage calldata message,
        bytes[] calldata signatures
    ) external returns (bool);

    /// 查询消息是否已处理
    function isMessageProcessed(bytes32 messageId)
        external view returns (bool);

    /// 获取消息状态
    function getMessageStatus(bytes32 messageId)
        external view returns (MessageStatus status);
}
```

### 6.3 HTLCVault

```solidity
interface IHTLCVault {
    /// 锁定资金
    function lock(
        address receiver,
        uint256 amount,
        bytes32 hashLock,
        uint256 timeout
    ) external returns (bytes32 lockId);

    /// 提取资金（提供原像）
    function claim(bytes32 lockId, bytes calldata secret) external;

    /// 退款（超时后）
    function refund(bytes32 lockId) external;
}
```

---

## 7. Relayer API

> Relayer 提供 HTTP API 供 SDK/前端调用。所有请求/响应格式统一。

### 7.1 基础信息

| 项目 | 值 |
|------|----|
| Base URL | `http://<relayer-host>:<port>/api/v1` |
| 请求格式 | `application/json` |
| 响应格式 | `application/json` |

### 7.2 统一响应格式

```json
{
    "code": 0,
    "message": "success",
    "data": {}
}
```

错误响应:
```json
{
    "code": 1001,
    "message": "invalid signature",
    "data": null,
    "requestId": "0x..."
}
```

### 7.3 接口清单

#### POST /api/v1/relay — 提交跨链消息

```json
// 请求
{
    "messageId": "0x...",
    "sourceChainId": "1",
    "targetChainId": "137",
    "sender": "0x...",
    "receiver": "0x...",
    "msgType": 1,
    "data": "0x...",
    "timestamp": 1717123456,
    "timeout": 1717200000,
    "signature": "0x..."
}

// 响应
{
    "code": 0,
    "message": "accepted",
    "data": {
        "messageId": "0x...",
        "status": "pending"
    }
}
```

#### GET /api/v1/message/:messageId — 查询消息状态

```json
// 响应
{
    "code": 0,
    "data": {
        "messageId": "0x...",
        "status": "delivered",        // pending | confirmed | signed | delivered | failed
        "sourceChainId": "1",
        "targetChainId": "137",
        "msgType": 1,
        "confirmations": 15,
        "requiredConfirmations": 12,
        "signatures": 3,
        "requiredSignatures": 3,
        "createdAt": 1717123456,
        "deliveredAt": 1717123500,
        "txHash": "0x..."
    }
}
```

#### GET /api/v1/games/:gameId — 查询游戏状态

```json
// 响应
{
    "code": 0,
    "data": {
        "gameId": 1001,
        "question": "BTC年底能否突破10万?",
        "options": ["是", "否"],
        "status": "active",           // created | active | resolved | settled | expired
        "totalPool": "10000000000000000000",
        "playerCount": 42,
        "deadline": 1717200000,
        "result": null,
        "chainId": "1"
    }
}
```

#### GET /api/v1/health — 健康检查

```json
{
    "code": 0,
    "data": {
        "status": "healthy",
        "blockNumber": 12345678,
        "chainId": "1",
        "peers": 5,
        "uptime": 3600
    }
}
```

---

## 8. SDK 接口

> SDK 是前端的唯一入口。前端只调用这6个方法，不关心底层跨链逻辑。

### 8.1 接口清单

```typescript
// FILE: sdk/src/index.ts

export class CrossChainBettingSDK {
    constructor(config: SDKConfig);

    /// 1. 创建游戏
    async createGame(params: {
        question: string;
        options: string[];
        deadline: number;          // unix timestamp
        chainId: string;           // 部署链ID
    }): Promise<{
        gameId: string;
        txHash: string;
    }>;

    /// 2. 下注
    async placeBet(params: {
        gameId: string;
        choice: number;            // 选项索引 0-based
        amount: string;            // wei
        chainId: string;
    }): Promise<{
        txHash: string;
        messageId: string;
    }>;

    /// 3. 查询游戏信息
    async getGameInfo(params: {
        gameId: string;
        chainId: string;
    }): Promise<GameInfo>;

    /// 4. 领奖
    async claimReward(params: {
        gameId: string;
        chainId: string;
    }): Promise<{
        txHash: string;
        amount: string;
    }>;

    /// 5. 退款
    async refund(params: {
        gameId: string;
        chainId: string;
    }): Promise<{
        txHash: string;
        amount: string;
    }>;

    /// 6. 查询消息状态
    async getMessageStatus(params: {
        messageId: string;
    }): Promise<MessageStatus>;
}
```

### 8.2 统一入参/出参规则

- 所有 `amount` 使用 **wei** 为单位 (string 类型避免精度丢失)
- 所有 `address` 使用 **checksummed hex** 格式
- 所有 `chainId` 使用 **decimal string** 格式
- 所有 `txHash` 使用 **0x 前缀 hex** 格式

### 8.3 错误处理

```typescript
try {
    const result = await sdk.placeBet({ gameId: "1001", choice: 0, amount: "1000000000000000000", chainId: "1" });
} catch (error) {
    if (error.code === 2002) {
        // 下注已关闭
        showError("下注已关闭");
    } else if (error.code === 4001) {
        // 资金不足
        showError("余额不足");
    }
}
```

---

## 9. 哈希计算规则

> **这是 Bug #1 的根因所在**。三端必须使用完全相同的哈希算法。

### 9.1 messageId 哈希

```text
messageId = keccak256(
    abi.encodePacked(sourceChainId, nonce, msgType, keccak256(data))
)
```

| 端 | 代码 |
|----|------|
| Solidity | `keccak256(abi.encodePacked(sourceChainId, nonce, msgType, keccak256(data)))` |
| Go | `crypto.Keccak256Hash(common.LeftPadBytes(sc.Bytes(),32), common.LeftPadBytes(new(big.Int).SetUint64(nonce).Bytes(),32), []byte{msgType}, crypto.Keccak256(data))` |
| TS | `ethers.solidityPackedKeccak256(["uint256","uint256","uint8","bytes32"], [sourceChainId, nonce, msgType, ethers.keccak256(data)])` |

### 9.2 签名哈希 (EIP-712)

```text
domainSeparator = keccak256(
    abi.encode(
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
        keccak256("CrossChainBetting"),
        keccak256("1.0.0"),
        chainId,
        contractAddress
    )
)

structHash = keccak256(
    abi.encode(
        keccak256("CrossChainMessage(uint256 messageId,uint256 sourceChainId,uint256 targetChainId,address sender,address receiver,uint8 msgType,bytes data,uint256 timestamp,uint256 timeout)"),
        message.messageId,
        message.sourceChainId,
        message.targetChainId,
        message.sender,
        message.receiver,
        message.msgType,
        keccak256(message.data),
        message.timestamp,
        message.timeout
    )
)

signHash = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash))
```

> **注意**: 这里的 structHash 包含了所有10个字段（包括 messageId），与旧版仅7个字段不同。

---

## 10. 签名与验证规则

### 10.1 签名生成 (Relayer)

```go
// Go: Signer 签名流程
signHash := GetEIP712SignHash(message)  // 见 §9.2
signature, err := crypto.Sign(signHash.Bytes(), privateKey)
signature[64] += 27  // 转为以太坊格式 (v=27/28)
```

### 10.2 签名验证 (合约)

```solidity
// Solidity: 验证单个签名
function verifySingleSignature(
    CrossChainMessage memory message,
    bytes memory signature
) internal view returns (address) {
    bytes32 signHash = getEIP712SignHash(message);  // 见 §9.2
    return ECDSA.recover(signHash, signature);
}
```

### 10.3 门限签名聚合

- 至少 **M-of-N** 个有效签名 (M=3, N=5)
- 签名按 `signer地址` 排序后拼接：`signature1 + signature2 + signature3`
- 合约端逐个 `ecrecover` 并去重验证

---



### 验证标准

修改完成后，执行以下验证：

1. **单元测试**: Solidity `hashMessage()` 和 Go `Hash()` 对相同输入返回相同结果
2. **签名测试**: Go生成签名 → Solidity `ecrecover` 恢复出相同地址
3. **集成测试**: 完整的跨链消息生命周期 (创建 → 签名 → 验证 → 处理)
4. **接口测试**: 所有API返回格式符合本规范
