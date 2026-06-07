分工方案

1) 角色 1：核心合约负责人（合约工程师）
核心职责
负责链上核心合约的设计、开发、审计和部署，是整个跨链框架的 “链上基石”。

具体任务
实现所有核心合约（BetManager、HTLCVault、SettlementManager、MessageVerifier）；
定义跨链消息协议（CrossChainMessage 结构、消息哈希生成、防重放逻辑）；
实现 HTLC 原子操作（lock/claim/refund）、门限签名验证、最终性抽象层对接；
合约单元测试、漏洞自查（重点覆盖资金安全、跨链消息验证、超时退款）；
编写合约部署脚本（适配 Ethereum/Polygon/Arbitrum 等多链）。

核心技术栈
Solidity、Hardhat/Truffle、OpenZeppelin（HTLC / 多签 / 防重放）、ChainAdapter 接口实现。

交付物
完整可编译的合约代码（带注释）；
合约单元测试用例（覆盖率≥90%）；
多链部署脚本 + 部署文档；
合约接口说明（给 SDK / 前端对接）。

2) 角色 2：跨链消息与 Relayer 网络负责人（链下 + 合约协作）
核心职责
负责 Relayer 网络搭建、跨链消息流转、最终性抽象层实现，是跨链通信的 “桥梁”。

具体任务
实现 Relayer 节点逻辑（监听链上事件、等待最终性确认、生成 / 签名 / 聚合消息哈希）；
开发 ChainAdapter 适配层（EthereumAdapter/PolygonAdapter 等，对接不同链的最终性规则）；
实现门限签名聚合（3/5 多签逻辑）、Relayer 节点管理（注册 / 权限 / 阈值配置）；
对接 MessageVerifier 合约，确保跨链消息的真实性和防重放；
测试跨链消息的双向流转（BET_CREATED→ROUND_RESULT→PAYOUT_CLAIM→REFUND 全流程）。

核心技术栈
Golang/TypeScript（Relayer 节点）、Web3.js/Ethers.js、签名算法（ECDSA）、链上事件监听、多链 RPC 对接。

交付物
Relayer 节点源码（可独立部署运行）；
ChainAdapter 抽象层代码；
跨链消息流转测试用例（覆盖多链场景）；
Relayer 部署 & 运维文档。

3) 角色 3：SDK 开发负责人（上层抽象 + 工具层）
核心职责
封装底层复杂逻辑，提供统一的 SDK 接口，让前端 / 业务层 “无感” 跨链细节。

具体任务
设计并实现 CrossChainSDK 类（createGame/placeBet/waitFinality/relayMessage/claimReward/refund）；
封装跨链消息组装、Relayer 调用、合约交互、最终性等待等底层逻辑；
适配多链环境（自动识别链 ID、切换 RPC、对接不同 ChainAdapter）；
提供 SDK 错误处理、日志、重试机制；
编写 SDK 文档和示例代码（给前端开发对接）。

核心技术栈
TypeScript/JavaScript、Web3.js/Ethers.js、模块化设计、API 抽象。

交付物
发布 npm 包（或源码）形式的 SDK；
SDK 完整文档（接口说明、示例、异常处理）；
SDK 单元测试 + 集成测试。

4) 角色 4：前端负责人（交互 + 状态机）
核心职责
负责前端界面开发、状态机管理、用户交互，让用户直观使用跨链竞猜功能。

具体任务
实现前端状态机（INIT→BETTING→LOCKED→RELAYING→FINALIZING→SETTLED→CLAIMED，及超时退款分支）；
开发核心页面：游戏创建页、下注页、开奖结果页、奖励领取 / 退款页；
集成 CrossChainSDK，对接所有链上操作（无需关心底层跨链逻辑）；
实现 “浏览器全流程验证” 功能（展示 BetCreated→MessageVerified→RoundFinished 等链路状态）；
适配多链钱包（MetaMask 等）、处理钱包授权 / 链切换、用户体验优化。

核心技术栈
React/Vue、TypeScript、Web3 Modal、状态管理（Redux/Pinia）、UI 组件库。

交付物
可运行的前端项目（兼容 PC / 移动端）；
前端状态机流程图 + 交互文档；
钱包对接 & 多链适配方案。

5) 角色 5：测试 & 集成负责人（全链路保障）
核心职责
负责全项目的集成测试、多链场景验证、问题兜底，是项目上线前的 “最后一道防线”。

具体任务
制定测试计划：覆盖单模块测试→跨模块集成测试→多链场景测试→压力测试；
搭建多链测试环境（Sepolia/Polygon 测试网等），部署合约 + Relayer+SDK + 前端；
模拟全流程场景：创建游戏→跨链下注→开奖→跨链领奖励、超时退款、异常场景（如 Relayer 签名不足、消息重放）；
对接其他 4 位成员，反馈模块间的集成问题（如合约接口与 SDK 不兼容、前端状态机与链上状态不一致）；
编写测试报告、梳理已知问题、推动修复，最终输出 “上线验收报告”。

核心技术栈
测试框架（Jest/Cypress）、多链测试网运维、区块链浏览器验证、问题定位工具。

交付物
全流程测试用例（覆盖正常 / 异常场景）；
多链测试环境部署文档；
测试报告（含问题清单 + 修复状态）；
上线验收标准 & 报告。
