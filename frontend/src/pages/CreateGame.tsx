import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { useSDK } from '../context/SDKContext';

export function CreateGame() {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [deadline, setDeadline] = useState('');
  const navigate = useNavigate();
  const addGame = useGameStore((state) => state.addGame);
  const sdk = useSDK();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sdk) {
      alert('SDK 未就绪，请稍后重试');
      return;
    }
    try {
      const filteredOptions = options.filter((opt) => opt.trim() !== '');
      const deadlineTimestamp = Math.floor(new Date(deadline).getTime() / 1000);

      const res = await sdk.createGame({
        question,
        options: filteredOptions,
        deadline: deadlineTimestamp,
        chainId: sdk.getCurrentChainId(),
      });

      addGame(res.gameId, {
        gameId: res.gameId,
        question,
        options: filteredOptions,
        deadline: deadlineTimestamp,
        totalPool: '1000000000000000000', // 初始奖池 1 ETH
        status: 'BETTING',
        creator: '',
      });

      alert(`游戏创建成功！ID: ${res.gameId}`);
      navigate(`/game/${res.gameId}`);
    } catch (err) {
      console.error('创建失败', err);
      alert('创建失败，请查看控制台错误');
    }
  };

  const addOption = () => {
    setOptions([...options, '']);
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  return (
    <form onSubmit={handleSubmit} style={{ padding: '1rem' }}>
      <div>
        <label>问题：</label>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          required
          style={{ width: '100%', marginBottom: '0.5rem' }}
        />
      </div>
      <div>
        <label>选项：</label>
        {options.map((opt, idx) => (
          <input
            key={idx}
            type="text"
            value={opt}
            onChange={(e) => updateOption(idx, e.target.value)}
            required
            style={{ display: 'block', marginBottom: '0.5rem', width: '100%' }}
          />
        ))}
        <button type="button" onClick={addOption} style={{ marginBottom: '0.5rem' }}>
          添加选项
        </button>
      </div>
      <div>
        <label>截止时间：</label>
        <input
          type="datetime-local"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          required
          style={{ marginBottom: '0.5rem', width: '100%' }}
        />
      </div>
      <button type="submit">创建</button>
    </form>
  );
}