import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { SDKProvider, useSDK } from './context/SDKContext';
import { PlaceBet } from './pages/PlaceBet';
import { FinalizeRound } from './pages/FinalizeRound';
import { QueryBet } from './pages/QueryBet';

function AppContent() {
  const { account, isConnected, connectWallet, disconnectWallet, connectDev } = useSDK();

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <nav style={{
        display: 'flex', gap: 24, padding: '0.75rem 1.5rem',
        background: '#fff', borderBottom: '1px solid #e5e7eb',
        alignItems: 'center', fontSize: '0.9rem', fontWeight: 500,
      }}>
        <Link to="/" style={{ textDecoration: 'none', color: '#4f46e5', fontWeight: 700 }}>跨链竞猜</Link>
        <Link to="/finalize" style={{ textDecoration: 'none', color: '#6b7280' }}>管理员开奖</Link>
        <Link to="/query" style={{ textDecoration: 'none', color: '#6b7280' }}>查询</Link>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {!isConnected ? (
            <>
              <button onClick={connectDev} style={{ padding: '0.4rem 1rem', borderRadius: 6, border: 'none', background: '#4f46e5', color: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>Dev 连接</button>
              <button onClick={connectWallet} style={{ padding: '0.4rem 1rem', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#374151', cursor: 'pointer', fontSize: '0.8rem' }}>MetaMask</button>
            </>
          ) : (
            <>
              <span style={{ color: '#059669', fontSize: '0.8rem' }}>● {account?.slice(0, 6)}...{account?.slice(-4)}</span>
              <button onClick={disconnectWallet} style={{ padding: '0.4rem 1rem', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#374151', cursor: 'pointer', fontSize: '0.8rem' }}>断开</button>
            </>
          )}
        </span>
      </nav>
      <Routes>
        <Route path="/" element={<PlaceBet />} />
        <Route path="/finalize" element={<FinalizeRound />} />
        <Route path="/query" element={<QueryBet />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <SDKProvider>
        <AppContent />
      </SDKProvider>
    </BrowserRouter>
  );
}
