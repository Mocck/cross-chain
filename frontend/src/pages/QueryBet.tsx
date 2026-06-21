import { useState } from 'react';
import { ethers } from 'ethers';
import { useSDK } from '../context/SDKContext';

const STATUS_COLOR: Record<number, string> = { 0: '#9ca3af', 1: '#f59e0b', 2: '#3b82f6', 3: '#059669', 4: '#ef4444' };
const STATUS_LABEL: Record<number, string> = { 0: 'NONE', 1: 'LOCKED', 2: 'FINALIZED', 3: 'CLAIMED', 4: 'REFUNDED' };

export function QueryBet() {
  const { sdk, chains } = useSDK();
  const activeChains = chains.filter(c => c.rpcUrl && c.betManagerAddress);
  const [betId, setBetId] = useState('');
  const [chain, setChain] = useState(activeChains[0]?.chainId || '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleQuery = async () => {
    if (!sdk || !betId) return;
    setLoading(true); setError(''); setResult(null);
    try { setResult(await sdk.getBetInfo({ betId, chainId: chain })); }
    catch (err: any) { setError(err.message || String(err)); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ maxWidth: 540, margin: '0 auto', padding: '2rem 1rem' }}>
      <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '1.5rem' }}>查询下注</h2>
      <div style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', border: '1px solid #e8e8e8' }}>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#555', marginBottom: '0.3rem' }}>链</label>
            <select value={chain} onChange={e => setChain(e.target.value)} style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, border: '1px solid #ddd', fontSize: '0.9rem', background: '#fff' }}>
              {activeChains.map(c => <option key={c.chainId} value={c.chainId}>{c.name}</option>)}
            </select>
          </div>
          <div style={{ flex: 3 }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#555', marginBottom: '0.3rem' }}>Bet ID</label>
            <input value={betId} onChange={e => setBetId(e.target.value)} placeholder="0x..." style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, border: '1px solid #ddd', fontSize: '0.85rem', boxSizing: 'border-box', fontFamily: 'monospace' }} />
          </div>
        </div>
        <button onClick={handleQuery} disabled={loading || !betId} style={{ width: '100%', padding: '0.8rem', borderRadius: 8, border: 'none', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', background: '#4f46e5', color: '#fff', marginTop: '1rem' }}>
          {loading ? '查询中...' : '查询'}
        </button>
        {error && <p style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: '0.75rem' }}>{error}</p>}
        {result && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: '#f9fafb', borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLOR[result.status] || '#999' }} />
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{STATUS_LABEL[result.status] || result.status}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.3rem 1rem', fontSize: '0.85rem' }}>
              <span style={{ color: '#888' }}>玩家:</span><span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{result.player}</span>
              <span style={{ color: '#888' }}>金额:</span><span style={{ fontWeight: 600 }}>{ethers.formatEther(result.amount)} ETH</span>
              <span style={{ color: '#888' }}>预测:</span><span>选项 {result.prediction}</span>
              <span style={{ color: '#888' }}>Round:</span><span>{result.roundId}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
