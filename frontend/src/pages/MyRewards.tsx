// src/pages/MyRewards.tsx
export function MyRewards() {
  return (
    <div>
      <h2>我的奖励</h2>
      <p>这里将展示你参与的游戏和可领取的奖励。</p>
      {/* 后续可以调用 useGameStore 过滤出用户下注的游戏，并显示领取按钮 */}
    </div>
  );
}