Bidirectional Cross-Chain Messaging Framework

以竞猜游戏作为项目展示的应用

1. 项目目标

构建一个支持异构链之间双向通信的跨链框架。

特点：

双向跨链消息传递
任意链可作为 Source Chain
任意链可作为 Settlement Chain
HTLC 原子操作支持
多签 Relayer 消息认证
最终性（Finality）抽象
超时退款机制
统一 SDK 接口
支持多链扩展
全流程链上可验证

2. 系统架构
                    ┌───────────────────┐
                    │     Frontend      │
                    └─────────┬─────────┘
                              │
                              ▼

                    ┌───────────────────┐
                    │ CrossChain SDK    │
                    └─────────┬─────────┘
                              │
                              ▼

 ┌─────────────────────────────────────────────────┐
 │             Relayer Network                     │
 │                                                 │
 │  Watch Events                                  │
 │  Verify Finality                               │
 │  Aggregate Signatures                          │
 │  Relay Messages                                │
 └───────────────┬─────────────────┬──────────────┘
                 │                 │

                 ▼                 ▼

        ┌────────────────┐  ┌────────────────┐
        │    Chain A     │  │    Chain B     │
        └────────────────┘  └────────────────┘

        BetManager          BetManager
        SettlementManager   SettlementManager
        HTLCVault           HTLCVault
        MessageVerifier     MessageVerifier
3. 核心设计原则
对称部署

每条链部署完全相同组件：

BetManager
SettlementManager
HTLCVault
MessageVerifier

因此：

Ethereum ↔ Polygon
Polygon ↔ Arbitrum
Base ↔ Optimism

均可直接通信。

4. 跨链角色模型

Source Chain
Settlement Chain

动态指定。

GameConfig
struct GameConfig {

    uint64 sourceChainId;

    uint64 settlementChainId;

    uint256 roundId;

}

示例

游戏1
Source      = Sepolia
Settlement  = Polygon
游戏2
Source      = Polygon
Settlement  = Sepolia

无需修改合约。

5. 核心合约设计
BetManager

负责：

创建游戏
创建下注
管理状态机
生成跨链事件
Storage
enum BetStatus {
    NONE,
    LOCKED,
    FINALIZED,
    CLAIMED,
    REFUNDED
}

struct Bet {

    bytes32 betId;

    address player;

    uint256 amount;

    uint8 prediction;

    uint256 roundId;

    uint256 timeout;

    BetStatus status;
}
Events
event BetCreated(
    bytes32 indexed betId
);

event BetFinalized(
    bytes32 indexed betId,
    uint256 payout
);

event BetRefunded(
    bytes32 indexed betId
);

6. HTLCVault

负责资金托管。

Storage
struct LockInfo {

    address owner;

    uint256 amount;

    bytes32 hashlock;

    uint256 timeout;

    bool claimed;
}
Functions
lock()

claim()

refund()
Events
event Locked();

event Claimed();

event Refunded();

7. SettlementManager

负责：

开奖
计算奖励
生成结算结果
Storage
struct Round {

    uint256 roundId;

    bool finished;

    uint8 result;
}
Events
event RoundFinished(
    uint256 roundId,
    uint8 result
);

event SettlementGenerated(
    bytes32 betId,
    uint256 payout
);

8. MessageVerifier

跨链安全核心。

职责：

验证消息真实性
验证Relayer签名
防重放攻击
Storage
mapping(address => bool) relayers;

mapping(bytes32 => bool) processed;

uint256 threshold;
Events
event MessageVerified(
    bytes32 msgHash
);

event MessageExecuted(
    bytes32 msgHash
);

9. 跨链消息协议

统一消息结构。

enum MessageType {

    BET_CREATED,

    ROUND_RESULT,

    PAYOUT_CLAIM,

    REFUND
}
struct CrossChainMessage {

    uint64 sourceChain;

    uint64 targetChain;

    MessageType msgType;

    uint256 nonce;

    bytes payload;
}

消息哈希：

bytes32 msgHash =
keccak256(
    abi.encode(message)
);

10. 双向消息流
下注消息
Chain A
    ↓
BET_CREATED
    ↓
Chain B
开奖消息
Chain B
    ↓
ROUND_RESULT
    ↓
Chain A
领取奖励消息
Chain A
    ↓
PAYOUT_CLAIM
    ↓
Chain B
超时退款消息
Chain A
    ↓
REFUND
    ↓
Chain B

11. Relayer Network
组成
Relayer1
Relayer2
Relayer3
Relayer4
Relayer5
工作流程
监听事件

↓

等待最终确认

↓

生成消息Hash

↓

签名

↓

聚合签名

↓

发送目标链
门限签名
Threshold = 3

即：3 / 5

12. 防重放攻击

维护：

mapping(bytes32 => bool)
processed;

执行前：

require(
    !processed[msgHash]
);

执行后：

processed[msgHash] = true;

13. 最终性抽象层

不同链：

Ethereum
Polygon
Arbitrum
Base

最终确认规则不同。

统一接口：

interface ChainAdapter {

    getChainId()

    getBlockNumber()

    getFinalizedHeight()

    waitFinality()

    submitTransaction()

}

实现：

EthereumAdapter

PolygonAdapter

ArbitrumAdapter

BaseAdapter

14. SDK设计

统一上层接口。

class CrossChainSDK {

    createGame()

    placeBet()

    waitFinality()

    relayMessage()

    claimReward()

    refund()

}

业务层无需关心：

链类型
确认块数
签名验证
消息格式

15. 前端状态机
INIT

↓

BETTING

↓

LOCKED

↓

RELAYING

↓

FINALIZING

↓

SETTLED

↓

CLAIMED

异常：

TIMEOUT

↓

REFUNDABLE

↓

REFUNDED

16. 浏览器验证流程

用户可验证：

Source Chain
BetCreated
Relayer
MessageVerified
Settlement Chain
RoundFinished

SettlementGenerated
Source Chain
BetFinalized

Claimed

完整链路：

BetCreated
      ↓
MessageVerified
      ↓
RoundFinished
      ↓
SettlementGenerated
      ↓
BetFinalized
      ↓
Claimed

17. 多链扩展

框架天然支持：

Ethereum
Polygon
Arbitrum
Optimism
Base
Avalanche
BSC

动态选择：

Game1

Ethereum
    →
Polygon

Game2

Polygon
    →
Arbitrum

Game3

Base
    →
Ethereum

18. 技术亮点
双向跨链消息传递
HTLC原子性保障
多签Relayer认证
防重放攻击
Finality抽象层
ChainAdapter统一接口
异构链兼容
浏览器全流程验证
SDK统一封装
可扩展到N链网络
