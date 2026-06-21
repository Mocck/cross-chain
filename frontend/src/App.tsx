// src/App.tsx
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { GameList } from './pages/GameList';
import { CreateGame } from './pages/CreateGame';
import { GameDetail } from './pages/GameDetail';
import { MyRewards } from './pages/MyRewards';
import { useMetaMask } from './hooks/useMetaMask';
import { SDKProvider } from './context/SDKContext'; // 导入

// 将原有的内容提取为一个子组件，以便使用 useMetaMask hook
function AppContent() {
  const { connect, disconnect, account, isActive } = useMetaMask();

  return (
    <div>
      <nav style={{ display: 'flex', gap: '10px', margin: '10px' }}>
        <Link to="/">大厅</Link>
        <Link to="/create">创建游戏</Link>
        <Link to="/my-rewards">我的奖励</Link>
        {!isActive ? (
          <button onClick={connect}>连接钱包</button>
        ) : (
          <span>{account?.slice(0,6)}... <button onClick={disconnect}>断开</button></span>
        )}
      </nav>
      <Routes>
        <Route path="/" element={<GameList />} />
        <Route path="/create" element={<CreateGame />} />
        <Route path="/game/:gameId" element={<GameDetail />} />
        <Route path="/my-rewards" element={<MyRewards />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <SDKProvider>
        <AppContent />
      </SDKProvider>
    </BrowserRouter>
  );
}

export default App;