import { CrossChainBettingSDK, BetStatus, LogLevel } from './src/index';
import { ethers } from 'ethers';

async function main() {
  console.log('🚀 Cross-Chain Betting SDK - 集成测试\n');

  // 1. 初始化 SDK
  const sdk = new CrossChainBettingSDK({
    chains: {
      '31337': {
        chainId: '31337',
        rpcUrl: 'http://127.0.0.1:8545',
        betManagerAddress: '0x0165878a594ca255338adfa4d48449f69242eb8f',
        settlementManagerAddress: '0xa513e6e4b8f2a923d98304ec87f64353c4d5c853',
        verifierAddress: '0x5fc8d32690cc91d4c39d9d3abcbd16989f875707'
      }
    },
    relayerBaseUrl: 'http://localhost:8080'
  }, LogLevel.DEBUG);

  // 2. 连接钱包
  const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
  const wallet = new ethers.Wallet(
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    provider
  );
  sdk.connect(wallet);
  console.log('✅ 钱包已连接:', wallet.address);

  // 3. 测试 Relayer 健康检查
  console.log('\n📡 测试 Relayer 连接...');
  try {
    const response = await fetch('http://localhost:8080/api/v1/health');
    const health = await response.json();
    console.log('✅ Relayer 健康检查:', health.message);
  } catch (error) {
    console.error('❌ Relayer 连接失败:', error);
    process.exit(1);
  }

  // 4. 跨链下注
  console.log('\n💰 发起跨链下注...');
  try {
    const betResult = await sdk.placeBet({
      sourceChainId: '31337',
      targetChainId: '31337',
      receiverContract: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
      prediction: 1,
      roundId: '1001',
      timeoutDuration: 3600,
      amount: ethers.parseEther('0.1').toString()
    });

    console.log('✅ 下注成功!');
    console.log('   BetID:', betResult.betId);
    console.log('   TxHash:', betResult.txHash);

    // 5. 查询下注信息
    console.log('\n📊 查询下注信息...');
    const betInfo = await sdk.getBetInfo({
      betId: betResult.betId,
      chainId: '31337'
    });

    console.log('✅ 下注详情:');
    console.log('   玩家:', betInfo.player);
    console.log('   金额:', ethers.formatEther(betInfo.amount), 'ETH');
    console.log('   预测:', betInfo.prediction);
    console.log('   回合ID:', betInfo.roundId);
    console.log('   状态:', BetStatus[betInfo.status]);
    console.log('   超时时间:', new Date(betInfo.timeout * 1000).toLocaleString());

    // 6. 测试消息查询（模拟 messageId）
    console.log('\n📨 测试跨链消息查询...');
    const testMessageId = '0x' + '1'.repeat(64);
    try {
      const messageStatus = await sdk.getMessageStatus({
        messageId: testMessageId
      });
      console.log('✅ 消息状态:', messageStatus.status);
      console.log('   确认数:', messageStatus.confirmations, '/', messageStatus.requiredConfirmations);
      console.log('   签名数:', messageStatus.signatures, '/', messageStatus.requiredSignatures);
    } catch (error: any) {
      console.log('ℹ️  消息未找到（预期行为）:', error.message);
    }

    // 7. 获取当前链ID
    const currentChainId = sdk.getCurrentChainId();
    console.log('\n🔗 当前链ID:', currentChainId);

    console.log('\n✅ 所有测试通过！');
  } catch (error: any) {
    console.error('\n❌ 测试失败:', error.message);
    if (error.code) {
      console.error('   错误码:', error.code);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
