import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { useSDK } from '../context/SDKContext';
import { ethers } from 'ethers';
import { MessageSteps } from '../components/MessageSteps';

export function GameDetail() {
  const { gameId } = useParams();
  const sdk = useSDK();
  const { games, addBet, setResult, setClaimed, setExpired, addGame } = useGameStore(); // 移除了 updateGameStatus
  const game = games[gameId!];
  const [selectedChoice, setSelectedChoice] = useState<number>(0);
  const [betAmount, setBetAmount] = useState('0.01');
  const [loading, setLoading] = useState(false);
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null);

  // 加载游戏信息（从 SDK 获取，并同步到 store）
  useEffect(() => {
    if (!sdk || !gameId) return;
    sdk.getGameInfo({ gameId, chainId: sdk.getCurrentChainId() })
      .then(info => {
        if (!games[gameId]) {
          addGame(gameId, {
            gameId: info.gameId,
            question: info.question,
            options: info.options,
            deadline: info.deadline,
            totalPool: info.totalPool,
            status: info.status as any,
            creator: info.creator,
            winningOption: info.winningOption,
          });
        }
      })
      .catch(err => console.error('加载游戏信息失败', err));
  }, [sdk, gameId, games, addGame]);

  const handlePlaceBet = async () => {
    if (!sdk) {
      alert('SDK 未就绪');
      return;
    }
    if (!game) {
      alert('游戏信息不存在');
      return;
    }
    if (game.status !== 'BETTING') {
      alert('当前状态无法下注');
      return;
    }
    setLoading(true);
    try {
      const amountWei = ethers.utils.parseEther(betAmount).toString();
      const res = await sdk.placeBet({
        gameId: gameId!,
        choice: selectedChoice,
        amount: amountWei,
        chainId: sdk.getCurrentChainId(),
      });
      addBet(gameId!, selectedChoice, amountWei);
      setCurrentMessageId(res.messageId);
      alert('下注成功，等待跨链确认');
    } catch (err: any) {
      console.error('下注失败', err);
      alert('下注失败: ' + (err.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!sdk) return;
    try {
      const res = await sdk.claimReward({ gameId: gameId!, chainId: sdk.getCurrentChainId() });
      setClaimed(gameId!, res.amount);
      alert(`领取成功！金额: ${ethers.utils.formatEther(res.amount)} ETH`);
    } catch (err: any) {
      alert('领取失败: ' + err.message);
    }
  };

  const handleRefund = async () => {
    if (!sdk) return;
    try {
      const res = await sdk.refund({ gameId: gameId!, chainId: sdk.getCurrentChainId() });
      setExpired(gameId!);
      alert(`退款成功！金额: ${ethers.utils.formatEther(res.amount)} ETH`);
    } catch (err: any) {
      alert('退款失败: ' + err.message);
    }
  };

  if (!game) {
    return <div>加载中...</div>;
  }

  return (
    <div style={{ padding: '1rem' }}>
      <h2>{game.question}</h2>
      <p>状态: {game.status}</p>
      <p>奖池: {ethers.utils.formatEther(game.totalPool)} ETH</p>
      <p>截止时间: {new Date(game.deadline * 1000).toLocaleString()}</p>

      {game.status === 'BETTING' && (
        <div>
          <h3>下注</h3>
          {game.options.map((opt, idx) => (
            <label key={idx} style={{ display: 'block', margin: '5px' }}>
              <input
                type="radio"
                name="choice"
                value={idx}
                onChange={() => setSelectedChoice(idx)}
                checked={selectedChoice === idx}
              />
              {opt}
            </label>
          ))}
          <div>
            <label>下注金额 (ETH): </label>
            <input
              type="number"
              step="0.01"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
            />
          </div>
          <button onClick={handlePlaceBet} disabled={loading}>
            {loading ? '处理中...' : '下注'}
          </button>
        </div>
      )}

      {currentMessageId && <MessageSteps messageId={currentMessageId} />}

      {game.status === 'SETTLED' && (
        <div>
          <p>获胜选项: {game.winningOption !== undefined ? game.options[game.winningOption] : '未知'}</p>
          {game.userBet && game.userBet.choice === game.winningOption && (
            <button onClick={handleClaim}>领取奖励</button>
          )}
        </div>
      )}

      {game.status === 'EXPIRED' && (
        <button onClick={handleRefund}>退款</button>
      )}

      {/* 开发调试：手动触发开奖 */}
      {import.meta.env.DEV && game.status === 'BETTING' && (
        <div style={{ marginTop: '2rem', borderTop: '1px solid #ccc', paddingTop: '1rem' }}>
          <button onClick={() => {
            const winner = window.prompt('输入获胜选项索引 (0,1,2...)', '0');
            if (winner !== null) {
              setResult(gameId!, parseInt(winner));
            }
          }}>
            🔧 模拟开奖 (仅开发)
          </button>
        </div>
      )}
    </div>
  );
}