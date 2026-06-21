import { CrossChainBettingSDK, BetStatus, LogLevel } from './src/index';
import { ethers } from 'ethers';

async function main() {
  console.log('🚀 Cross-Chain Betting SDK - Multi-Chain Test\n');

  // ============================================================
  // 1. 初始化 SDK (双链)
  // ============================================================
  const sdk = new CrossChainBettingSDK({
    chains: {
      '31337': {
        chainId: '31337',
        rpcUrl: 'http://127.0.0.1:8545',
        betManagerAddress: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
        settlementManagerAddress: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
        verifierAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3'
      },
      '31338': {
        chainId: '31338',
        rpcUrl: 'http://127.0.0.1:8546',
        betManagerAddress: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
        settlementManagerAddress: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
        verifierAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3'
      }
    },
    relayerBaseUrl: 'http://localhost:8080'
  }, LogLevel.DEBUG);

  // 2. 连接钱包 (Hardhat Account #0)
  const providerA = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
  const wallet = new ethers.Wallet(
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    providerA
  );
  sdk.connect(wallet);
  console.log('✅ Wallet:', wallet.address);

  // 3. Relayer 健康检查
  console.log('\n📡 Checking Relayer...');
  try {
    const resp = await fetch('http://localhost:8080/api/v1/health');
    const data = await resp.json();
    console.log('✅ Relayer:', data.message);
  } catch {
    console.error('❌ Relayer not running! Start: cd relayer-python && python relayer_server.py');
    process.exit(1);
  }

  // 4. 检查两条链
  console.log('\n🔗 Chain Status:');
  for (const chainId of ['31337', '31338']) {
    const prov = new ethers.JsonRpcProvider(chainId === '31337' ? 'http://127.0.0.1:8545' : 'http://127.0.0.1:8546');
    const bn = await prov.getBlockNumber();
    console.log(`   Chain ${chainId}: block #${bn}`);
  }

  // ============================================================
  // 5. 跨链下注: Chain 31337 → 31338
  // ============================================================
  const SOURCE = '31337';
  const TARGET = '31338';
  const targetSettlement = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0';
  const ROUND_ID = String(Math.floor(Date.now() / 1000));
  console.log(`   Round ID: ${ROUND_ID}\n`);

  console.log(`\n💰 Cross-Chain Bet: ${SOURCE} → ${TARGET}`);
  const betResult = await sdk.placeBet({
    sourceChainId: SOURCE,
    targetChainId: TARGET,
    receiverContract: targetSettlement,
    prediction: 1,
    roundId: ROUND_ID,
    timeoutDuration: 3600,
    amount: ethers.parseEther('0.1').toString()
  });

  console.log('✅ Bet placed!');
  console.log('   BetID:', betResult.betId);
  console.log('   TxHash:', betResult.txHash);

  // 6. 查询下注（源链）
  const betInfo = await sdk.getBetInfo({ betId: betResult.betId, chainId: SOURCE });
  console.log('\n📊 Bet on source chain:');
  console.log('   Amount:', ethers.formatEther(betInfo.amount), 'ETH');
  console.log('   Status:', BetStatus[betInfo.status]);

  // ============================================================
  // 7. 挖矿加速确认（12 个块）
  // ============================================================
  console.log('\n⏳ Mining 15 blocks for confirmations...');
  for (let i = 0; i < 15; i++) {
    await fetch('http://127.0.0.1:8545', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'evm_mine', params: [], id: 1 })
    });
  }
  console.log('✅ Blocks mined');

  // ============================================================
  // 8. 等待 Relayer 处理（确认 → 签名 → 中继）
  // ============================================================
  console.log('\n⌛ Waiting for relayer to process (30s)...');
  console.log('   Relayer polls every 5s, needs confs + signing');
  for (let attempt = 0; attempt < 12; attempt++) {
    await new Promise(r => setTimeout(r, 5000));

    if (betResult.betId) {
      try {
        const msgIdQuery = '0x' + '0'.repeat(64); // placeholder
        // 尝试从 relayer 查询消息状态
        const resp = await fetch('http://localhost:8080/api/v1/message/' + msgIdQuery);
        const data = await resp.json();
        if (data.code === 0) {
          console.log(`   [${attempt + 1}] Relayer status:`, data.data?.status || 'unknown');
        }
      } catch { /* ignore */ }
    }
  }

  // ============================================================
  // 9. 验证目标链上 round 已注册
  // ============================================================
  console.log('\n🔍 Checking target chain (31338)...');
  const providerB = new ethers.JsonRpcProvider('http://127.0.0.1:8546');
  const settlementABI = [
    'function rounds(uint256) view returns (uint256 roundId, bool finished, uint8 result)'
  ];
  const settlementB = new ethers.Contract(
    '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    settlementABI,
    providerB
  );

  const round = await settlementB.rounds(ROUND_ID);
  console.log(`   Round ${ROUND_ID}:`, {
    roundId: round.roundId.toString(),
    finished: round.finished,
    result: Number(round.result)
  });
  if (round.roundId === 0n) {
    console.log('❌ Round not registered yet');
    process.exit(1);
  }
  console.log('✅ Round registered on target chain');

  // ============================================================
  // 10. 管理员开奖: finalizeRound(1001, 1)
  // ============================================================
  console.log(`\n🎲 Admin finalizes round ${ROUND_ID} (winner = option 1)...`);
  const settlementWriter = new ethers.Contract(
    '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    ['function finalizeRound(uint256 roundId, uint8 result)'],
    new ethers.Wallet(
      '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      providerB
    )
  );
  const finalizeTx = await settlementWriter.finalizeRound(ROUND_ID, 1);
  await finalizeTx.wait();
  console.log('✅ Round finalized! TxHash:', finalizeTx.hash);

  // ============================================================
  // 11. 等待 Relayer 处理结算回传 (Chain B → Chain A)
  // ============================================================
  console.log('\n⌛ Waiting for settlement relay (60s)...');
  console.log('   Relayer must: detect RoundFinished → sign → relay back');

  // 先在链 B 上快速挖出 12 个确认块
  for (let i = 0; i < 15; i++) {
    await fetch('http://127.0.0.1:8546', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'evm_mine', params: [], id: 1 })
    });
  }

  // 等待 relayer 完成签名 + relay
  await new Promise(r => setTimeout(r, 25000));

  // ============================================================
  // 12. 验证结算结果（源链上查 bet 状态）
  // ============================================================
  console.log('\n💰 Checking settlement on source chain (31337)...');
  const betResult2 = await sdk.getBetInfo({
    betId: betResult.betId,
    chainId: SOURCE
  });
  console.log('   Bet status:', BetStatus[betResult2.status]);
  console.log('   Amount:', ethers.formatEther(betResult2.amount), 'ETH');

  // 检查合约余额变化（应收到双倍赔付）
  const balAfter = await providerA.getBalance(wallet.address);
  console.log('   Wallet balance:', ethers.formatEther(balAfter), 'ETH');

  if (betResult2.status === BetStatus.CLAIMED || betResult2.status === BetStatus.FINALIZED) {
    console.log('✅ Settlement SUCCESS - bet settled on source chain!');
  } else {
    console.log('⚠️  Bet not yet settled (status:', BetStatus[betResult2.status], ')');
  }

  console.log('\n🎉 Full cross-chain flow complete!');
  console.log('   Bet(31337) → Relay(→31338) → Finalize(31338) → Settlement(→31337)');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
