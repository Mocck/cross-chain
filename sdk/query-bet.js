const { ethers } = require('ethers');
const { CrossChainBettingSDK, BetStatus, LogLevel } = require('./dist/index');

(async () => {
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
  });

  const betId = '0x51b20f5f96e7ab121267e8ac877eef1f416d3a8cb9bb5b34af5a449b1a51a78a';

  const info = await sdk.getBetInfo({ betId, chainId: '31337' });
  console.log('Status:   ', BetStatus[info.status]);
  console.log('Player:   ', info.player);
  console.log('Amount:   ', ethers.formatEther(info.amount), 'ETH');
  console.log('Prediction:', info.prediction);
  console.log('Round:    ', info.roundId);
  console.log('Timeout:  ', new Date(info.timeout * 1000).toLocaleString());

  // 也查两条链的 round 状态
  const providerB = new ethers.JsonRpcProvider('http://127.0.0.1:8546');
  const smB = new ethers.Contract('0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0', [
    'function rounds(uint256) view returns (uint256 roundId, bool finished, uint8 result)'
  ], providerB);
  const round = await smB.rounds(info.roundId);
  console.log('\nRound on Chain B:');
  console.log('   roundId: ', round.roundId.toString());
  console.log('   finished:', round.finished);
  console.log('   result:  ', Number(round.result));
})();
