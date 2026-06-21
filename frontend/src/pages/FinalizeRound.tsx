import { useState } from 'react';
import { ethers } from 'ethers';
import { useSDK } from '../context/SDKContext';

export function FinalizeRound() {
  const { chains } = useSDK();
  const activeChains = chains.filter(c => c.rpcUrl && c.settlementManagerAddress);
  const [chain, setChain] = useState(activeChains[0]?.chainId || '');
  const [roundId, setRoundId] = useState('');
  const [winner, setWinner] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const c = activeChains.find(x => x.chainId === chain);

  const handleFinalize = async () => {
    if (!c) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const prov = new ethers.JsonRpcProvider(c.rpcUrl);
      const wallet = new ethers.Wallet('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', prov);
      const sm = new ethers.Contract(c.settlementManagerAddress, ['function finalizeRound(uint256 roundId, uint8 result)'], wallet);
      const tx = await sm.finalizeRound(roundId, winner);
      setResult({ txHash: (await tx.wait()).hash });
    } catch (err: any) { setError(err.reason || err.message || String(err)); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '2rem 1rem' }}>
      <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '1.5rem' }}>管理员开奖</h2>
      <div style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', border: '1px solid #e8e8e8' }}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#555', marginBottom: '0.3rem' }}>目标链</label>
          <select value={chain} onChange={e => setChain(e.target.value)} style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, border: '1px solid #ddd', fontSize: '0.9rem', background: '#fff' }}>
            {activeChains.map(c => <option key={c.chainId} value={c.chainId}>{c.name} · {c.chainId}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#555', marginBottom: '0.3rem' }}>Round ID</label>
          <input value={roundId} onChange={e => setRoundId(e.target.value)} placeholder="如: 1782047891" style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, border: '1px solid #ddd', fontSize: '0.9rem', boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#555', marginBottom: '0.3rem' }}>获胜选项</label>
          <select value={winner} onChange={e => setWinner(Number(e.target.value))} style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, border: '1px solid #ddd', fontSize: '0.9rem', background: '#fff' }}>
            <option value={0}>选项 0</option>
            <option value={1}>选项 1</option>
          </select>
        </div>
        <button onClick={handleFinalize} disabled={loading} style={{ width: '100%', padding: '0.8rem', borderRadius: 8, border: 'none', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', background: '#f59e0b', color: '#fff' }}>
          {loading ? '⏳ 开奖中...' : '🔓 开奖'}
        </button>
        {error && <p style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: '0.75rem' }}>{error}</p>}
        {result && <div style={{ marginTop: '1rem', padding: '1rem', background: '#ecfdf5', borderRadius: 8, border: '1px solid #a7f3d0' }}><p style={{ margin: 0, fontWeight: 600, color: '#059669' }}>✅ 开奖成功</p><p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#999', wordBreak: 'break-all' }}>Tx: {result.txHash}</p></div>}
      </div>
    </div>
  );
}
