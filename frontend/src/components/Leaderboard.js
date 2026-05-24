import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { formatXp, getMondayResetCountdown } from '../utils/format';

const Leaderboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(getMondayResetCountdown());

  useEffect(() => {
    api.getLeaderboard().then((res) => {
      setData(res.data);
      setLoading(false);
    });
    const t = setInterval(() => setCountdown(getMondayResetCountdown()), 60000);
    return () => clearInterval(t);
  }, []);

  if (loading) {
    return (
      <div className="page loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  const rankings = data?.rankings || [];
  const currentUser = data?.currentUser;
  const top3 = rankings.slice(0, 3);
  const rest = rankings.slice(3);

  const podiumOrder = [
    top3[1] ? { ...top3[1], slot: 'second', medal: '🥈' } : null,
    top3[0] ? { ...top3[0], slot: 'first', medal: '🥇' } : null,
    top3[2] ? { ...top3[2], slot: 'third', medal: '🥉' } : null,
  ].filter(Boolean);

  return (
    <div className="page">
      <h1 className="page-title">الصدارة</h1>
      <p className="page-subtitle">Leaderboard · كل المستخدمين</p>
      <p className="text-secondary" style={{ fontSize: '0.85rem', marginBottom: 12 }}>
        لصدارة الأصدقاء فقط → <Link to="/friends" className="text-green">👥 الأصدقاء</Link>
      </p>

      <div className="reset-timer">
        ⏱ يتجدد بعد {countdown.label}
      </div>

      {podiumOrder.length > 0 && (
        <div className="podium">
          {podiumOrder.map((entry) => (
            <div key={entry.userId} className={`podium-slot ${entry.slot}`}>
              <div className="podium-medal">{entry.medal}</div>
              <div className="podium-name">{entry.displayName}</div>
              <div className="podium-xp font-mono">{formatXp(entry.weeklyXp)} XP</div>
            </div>
          ))}
        </div>
      )}

      {currentUser && (
        <div className="leaderboard-row is-me">
          <span className="row-rank">#{currentUser.rank}</span>
          <span style={{ flex: 1 }}>أنت · {currentUser.displayName}</span>
          <span className="font-mono text-green">{formatXp(currentUser.weeklyXp)} XP</span>
        </div>
      )}

      {rest.map((entry) => {
        const isMe = currentUser?.userId === entry.userId;
        if (isMe) return null;
        return (
          <div key={entry.userId} className="leaderboard-row">
            <span className="row-rank">#{entry.rank}</span>
            <span style={{ flex: 1 }}>{entry.displayName}</span>
            <span className="font-mono text-secondary">{formatXp(entry.weeklyXp)} XP</span>
          </div>
        );
      })}

      {rankings.length === 0 && (
        <div className="empty-state">
          <p>سجّل مصروفاتك عشان تظهر هنا!</p>
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
