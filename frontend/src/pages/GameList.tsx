import { Link } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';

export function GameList() {
  const { games } = useGameStore();  // 只取 games，去掉未使用的 setGames

  return (
    <div>
      <h1>竞猜大厅</h1>
      <Link to="/create"><button>创建新竞猜</button></Link>
      {Object.values(games).length === 0 ? (
        <p>暂无游戏，点击上方按钮创建第一个竞猜！</p>
      ) : (
        Object.values(games).map(game => (
          <div key={game.gameId} style={{ border: '1px solid #ccc', margin: '10px', padding: '10px' }}>
            <h3>{game.question}</h3>
            <p>奖池: {game.totalPool} wei</p>
            <p>状态: {game.status}</p>
            <Link to={`/game/${game.gameId}`}><button>查看详情</button></Link>
          </div>
        ))
      )}
    </div>
  );
}