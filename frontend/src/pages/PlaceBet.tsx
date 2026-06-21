import { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import { BetStatus } from 'cross-chain-betting-sdk';
import { useSDK } from '../context/SDKContext';

type Step = 'bet' | 'relaying' | 'relayed' | 'finalizing' | 'settling' | 'done';

const styles = {
  page: { maxWidth: 640, margin: '0 auto', padding: '2rem 1rem', fontFamily: 'system-ui, sans-serif' },
  heading: { fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.25rem' },
  sub: { color: '#888', fontSize: '0.8rem', marginBottom: '1.5rem' },
  card: { background: '#fff', borderRadius: 12, padding: '1.5rem', border: '1px solid #e8e8e8', marginBottom: '1rem' },
  label: { display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#555', marginBottom: '0.25rem' },
  select: { width: '100%', padding: '0.55rem 0.7rem', borderRadius: 8, border: '1px solid #ddd', fontSize: '0.85rem', background: '#fff', cursor: 'pointer' },
  btn: { padding: '0.7rem 1.5rem', borderRadius: 8, border: 'none', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', background: '#4f46e5', color: '#fff' },
  btnWarn: { padding: '0.7rem 1.5rem', borderRadius: 8, border: 'none', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', background: '#f59e0b', color: '#fff' },
  steps: { display: 'flex', gap: 4, marginBottom: '1.5rem', flexWrap: 'wrap' as any },
  stepDot: (active: boolean, done: boolean) => ({
    padding: '4px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
    background: active ? '#4f46e5' : done ? '#d1fae5' : '#f3f4f6',
    color: active ? '#fff' : done ? '#059669' : '#9ca3af',
  }),
  banner: (ok: boolean) => ({ background: ok ? '#ecfdf5' : '#fff7ed', padding: '1.25rem', borderRadius: 10, border: ok ? '1px solid #a7f3d0' : '1px solid #fed7aa' }),
  tx: { wordBreak: 'break-all' as any, fontSize: '0.78rem', color: '#999' },
  row: { display: 'flex', gap: '0.75rem', alignItems: 'center' as any },
  error: { color: '#dc2626', fontSize: '0.85rem', marginTop: '0.5rem' },
};

export function PlaceBet() {
  const { sdk, isConnected, chains } = useSDK();
  const activeChains = chains.filter(c => c.rpcUrl && c.betManagerAddress);
  const chainById = (id: string) => activeChains.find(c => c.chainId === id);

  const [sourceChain, setSourceChain] = useState(activeChains[0]?.chainId || '');
  const [targetChain, setTargetChain] = useState(activeChains[1]?.chainId || '');
  const [roundId] = useState(() => String(Math.floor(Date.now() / 1000)));
  const [prediction, setPrediction] = useState<number>(0);
  const [amount, setAmount] = useState('0.1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [step, setStep] = useState<Step>('bet');
  const [betId, setBetId] = useState('');
  const [betStatus, setBetStatus] = useState<number | null>(null);
  const [finalResult, setFinalResult] = useState('');
  const [txHash, setTxHash] = useState('');
  const [winner, setWinner] = useState<number>(0);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (activeChains.length === 0) return;
    // 初始化：源链=第1个，目标=第2个
    if (!sourceChain || !activeChains.find(c => c.chainId === sourceChain)) {
      setSourceChain(activeChains[0].chainId);
    }
    if (!targetChain || targetChain === sourceChain || !activeChains.find(c => c.chainId === targetChain)) {
      const other = activeChains.find(c => c.chainId !== sourceChain);
      if (other) setTargetChain(other.chainId);
    }
  }, [activeChains, sourceChain, targetChain]);
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const sc = chainById(sourceChain);
  const tc = chainById(targetChain);

  const handleBet = async () => {
    if (!sdk || !isConnected) { setError('请先连接钱包'); return; }
    if (!tc) { setError('目标链未配置 RPC/合约地址'); return; }
    setLoading(true); setError('');
    try {
      // 为源链创建正确的钱包，确保交易发到对应链
      const sourceRpc = sc?.rpcUrl || '';
      const pk = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
      const chainWallet = sourceChain === '31337'
        ? new ethers.Wallet(pk, new ethers.JsonRpcProvider(sourceRpc))
        : new ethers.Wallet(pk, new ethers.JsonRpcProvider(sourceRpc));
      sdk.connect(chainWallet as any);

      const res = await sdk.placeBet({
        sourceChainId: sourceChain,
        targetChainId: targetChain,
        receiverContract: tc.settlementManagerAddress,
        prediction, roundId, timeoutDuration: 3600,
        amount: ethers.parseEther(amount).toString()
      });
      setBetId(res.betId); setTxHash(res.txHash); setStep('relaying');
      // 本地挖矿加速
      if (sc?.rpcUrl.includes('127.0.0.1')) {
        for (let i = 0; i < 5; i++) await fetch(sc.rpcUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'evm_mine', params: [], id: 1 }) });
      }
      startRelayPolling(res.betId);
    } catch (err: any) { setError(err.message || String(err)); }
    finally { setLoading(false); }
  };

  const startRelayPolling = (bid: string) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(async () => {
      try {
        const info = await sdk!.getBetInfo({ betId: bid, chainId: sourceChain });
        setBetStatus(info.status);
        if (!tc) return;
        const prov = new ethers.JsonRpcProvider(tc.rpcUrl);
        const sm = new ethers.Contract(tc.settlementManagerAddress, [
          'function rounds(uint256) view returns (uint256 roundId, bool finished, uint8 result)'
        ], prov);
        const round = await sm.rounds(roundId);
        if (round.roundId > 0n) { setStep('relayed'); clearInterval(timerRef.current!); if (round.finished) { setStep('done'); finishCheck(bid); } }
      } catch {}
    }, 3000);
  };

  const handleFinalize = async () => {
    if (!tc) return;
    setLoading(true); setError(''); setStep('finalizing');
    try {
      const prov = new ethers.JsonRpcProvider(tc.rpcUrl);
      const wallet = new ethers.Wallet('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', prov);
      const sm = new ethers.Contract(tc.settlementManagerAddress, ['function finalizeRound(uint256 roundId, uint8 result)'], wallet);
      await (await sm.finalizeRound(roundId, winner)).wait();
      if (tc.rpcUrl.includes('127.0.0.1')) {
        for (let i = 0; i < 5; i++) await fetch(tc.rpcUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'evm_mine', params: [], id: 1 }) });
      }
      setStep('settling');
      startSettlePolling(betId);
    } catch (err: any) { setError(err.reason || err.message || String(err)); setStep('relayed'); }
    finally { setLoading(false); }
  };

  const startSettlePolling = (bid: string) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(async () => {
      try {
        const info = await sdk!.getBetInfo({ betId: bid, chainId: sourceChain });
        setBetStatus(info.status);
        if (info.status === BetStatus.CLAIMED || info.status === BetStatus.FINALIZED) { clearInterval(timerRef.current!); finishCheck(bid); }
      } catch {}
    }, 3000);
  };

  const finishCheck = async (bid: string) => {
    const info = await sdk!.getBetInfo({ betId: bid, chainId: sourceChain });
    setFinalResult(info.status === BetStatus.CLAIMED
      ? `✅ 赢了！收到 ${ethers.formatEther(BigInt(info.amount) * 2n)} ETH`
      : '❌ 输了，资金归平台');
    setStep('done');
  };

  const stepIdx = ['bet','relaying','relayed','finalizing','settling','done'].indexOf(step);

  return (
    <div style={styles.page}>
      <h2 style={styles.heading}>跨链竞猜</h2>
      <p style={styles.sub}>Round #{roundId}</p>

      <div style={styles.steps}>
        {['下注', '跨链中', '待开奖', '开奖中', '结算中', '完成'].map((s, i) => (
          <span key={s} style={styles.stepDot(i === stepIdx, i < stepIdx)}>{s}</span>
        ))}
      </div>

      {/* Step 1: 下注 */}
      {step === 'bet' && (
        <div style={styles.card}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={styles.label}>下注链</label>
            <select style={styles.select} value={sourceChain} onChange={e => setSourceChain(e.target.value)}>
              {activeChains.map(c => <option key={c.chainId} value={c.chainId}>{c.name} · {c.chainId}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: '1rem', textAlign: 'center', color: '#aaa', fontSize: '1.2rem' }}>↓ 跨链 relay ↓</div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={styles.label}>目标结算链</label>
            <select style={styles.select} value={targetChain} onChange={e => setTargetChain(e.target.value)}>
              {activeChains.filter(c => c.chainId !== sourceChain).map(c => <option key={c.chainId} value={c.chainId}>{c.name} · {c.chainId}</option>)}
            </select>
          </div>
          {(!tc?.rpcUrl || !tc?.betManagerAddress) && (
            <p style={{ color: '#f59e0b', fontSize: '0.8rem', marginTop: '-0.5rem' }}>⚠️ 目标链未配置 RPC / 合约地址，请在 SDKContext 中填写</p>
          )}
          <div style={styles.row}>
            <div style={{ flex: 1 }}>
              <label style={styles.label}>预测选项</label>
              <select style={styles.select} value={prediction} onChange={e => setPrediction(Number(e.target.value))}>
                <option value={0}>选项 0</option>
                <option value={1}>选项 1</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={styles.label}>下注金额</label>
              <div style={{ ...styles.row, border: '1px solid #ddd', borderRadius: 8, padding: '0 0.8rem' }}>
                <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} style={{ border: 'none', outline: 'none', flex: 1, padding: '0.6rem 0', fontSize: '0.9rem' }} />
                <span style={{ color: '#999', fontWeight: 600 }}>ETH</span>
              </div>
            </div>
          </div>
          <button onClick={handleBet} disabled={loading} style={{ ...styles.btn, width: '100%', marginTop: '1.25rem', padding: '0.8rem' }}>
            {loading ? '⏳ 下注中...' : '🔒 确认下注'}
          </button>
          {error && <p style={styles.error}>{error}</p>}
        </div>
      )}

      {/* Step 2: Relay */}
      {step === 'relaying' && (
        <div style={styles.banner(false)}>
          <p style={{ fontWeight: 600, margin: '0 0 0.5rem' }}>⏳ 跨链中继进行中... ({sc?.name} → {tc?.name})</p>
          <p style={{ ...styles.tx, margin: 0 }}>BetID: <code>{betId}</code></p>
          <p style={{ ...styles.tx, margin: '0.25rem 0 0' }}>Tx: <code>{txHash}</code></p>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>源链状态: <strong>{betStatus !== null ? ['NONE','LOCKED','FINALIZED','CLAIMED','REFUNDED'][betStatus] : '...'}</strong></p>
        </div>
      )}

      {/* Step 3: 开奖 */}
      {step === 'relayed' && (
        <div style={styles.banner(true)}>
          <p style={{ fontWeight: 600, margin: '0 0 1rem' }}>✅ Round 已注册到 {tc?.name}</p>
          <div style={{ marginBottom: '1rem' }}>
            <label style={styles.label}>开奖结果</label>
            <select style={styles.select} value={winner} onChange={e => setWinner(Number(e.target.value))}>
              <option value={0}>选项 0 获胜</option>
              <option value={1}>选项 1 获胜</option>
            </select>
          </div>
          <button onClick={handleFinalize} disabled={loading} style={{ ...styles.btnWarn, width: '100%', padding: '0.8rem' }}>
            {loading ? '⏳ 开奖中...' : '🎯 确认开奖'}
          </button>
          {error && <p style={styles.error}>{error}</p>}
        </div>
      )}

      {/* Step 4: 结算 relay */}
      {step === 'settling' && (
        <div style={styles.banner(false)}>
          <p style={{ fontWeight: 600, margin: 0 }}>⏳ 结算 relay 回传中... ({tc?.name} → {sc?.name})</p>
          <p style={{ fontSize: '0.8rem', color: '#888', margin: '0.3rem 0 0' }}>relayer 检测开奖事件 → 签名 → 回传源链结算</p>
        </div>
      )}

      {/* Step 5: 结果 */}
      {step === 'done' && (
        <div style={{ ...styles.banner(finalResult.startsWith('✅')) }}>
          <p style={{ fontWeight: 700, margin: '0 0 0.5rem', fontSize: '1.1rem' }}>{finalResult}</p>
          <p style={{ ...styles.tx, margin: 0 }}>BetID: <code>{betId}</code></p>
          <p style={{ ...styles.tx, margin: '0.25rem 0 0' }}>预测: 选项 {prediction} | Round: {roundId}</p>
        </div>
      )}
    </div>
  );
}
