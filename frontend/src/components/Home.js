import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { formatRiyal, formatXp, getGreeting } from '../utils/format';
import { getCategoryMeta } from '../utils/categories';
import ProgressRing from './ui/ProgressRing';

const Home = ({ user, onSignOut }) => {
  const [expenses, setExpenses] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    try {
      setError(null);
      const [expRes, profileRes, chRes] = await Promise.all([
        api.getExpenses(),
        api.getProfile().catch(() => ({ data: null })),
        api.getChallenges().catch(() => ({ data: { challenges: [] } })),
      ]);
      setExpenses(expRes.data.expenses || []);
      setProfile(profileRes.data);
      const active = (chRes.data.challenges || []).filter((c) => c.status === 'active').slice(0, 3);
      setChallenges(active);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'تعذر التحميل');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const xpPercent = profile
    ? Math.round((profile.xpProgress / profile.xpToNextLevel) * 100)
    : 0;

  const recent = [...expenses]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  if (loading) {
    return (
      <div className="page loading-screen">
        <div className="spinner" />
        <p>جاري التحميل...</p>
      </div>
    );
  }

  return (
    <div className="page">
      {error && <div className="error-banner">{error}</div>}

      <div className="header-bar">
        <div>
          <p className="tagline">ريالي · ryialAI</p>
          <p className="text-secondary" style={{ fontSize: '0.8rem', marginBottom: 4 }}>مالك، في يدك</p>
          <h1 className="page-title">{getGreeting()}، {user.username}</h1>
        </div>
        <button type="button" className="sign-out-btn" onClick={onSignOut}>خروج</button>
      </div>

      {profile && (
        <div className="glass-card xp-hero">
          <div className="xp-hero-top">
            <div className="xp-greeting">
              <p className="text-secondary">المستوى {profile.level}</p>
              <h2 className="font-mono">{formatXp(profile.xp)} XP</h2>
            </div>
            <span className="level-badge">Lv {profile.level}</span>
          </div>
          <div className="xp-bar-track">
            <div className="xp-bar-fill" style={{ width: `${xpPercent}%` }} />
          </div>
          <div className="xp-meta">
            <span>{profile.xpProgress} / {profile.xpToNextLevel}</span>
            <span>+20 XP لكل مصروف</span>
          </div>
          {profile.streakMultiplierActive && (
            <p className="streak-flame" style={{ marginTop: 8 }}>🔥 مضاعف ×2 اليوم!</p>
          )}
        </div>
      )}

      {challenges.length > 0 && (
        <>
          <h2 className="section-title">
            <span>تحديات اليوم</span>
            <Link to="/challenges" className="text-green" style={{ fontSize: '0.8rem', textDecoration: 'none' }}>الكل ←</Link>
          </h2>
          {challenges.map((ch) => (
            <div key={ch.challengeId} className="challenge-card ai-active">
              <div className="challenge-card-header">
                <ProgressRing progress={ch.progressPercent ?? 0} size={52}>
                  {ch.progressPercent ?? 0}%
                </ProgressRing>
                <div className="challenge-card-body">
                  <span className="ai-chip">✦ AI</span>
                  <h3>{ch.title}</h3>
                  <p className="challenge-desc">{ch.description}</p>
                </div>
                <span className="challenge-xp-tag">+{ch.xpReward}</span>
              </div>
            </div>
          ))}
        </>
      )}

      <h2 className="section-title">آخر المصروفات</h2>
      {recent.length === 0 ? (
        <div className="empty-state">
          <p>ما سجّيت مصروفات بعد</p>
          <p>اضغط + وابدأ تكسب XP</p>
        </div>
      ) : (
        recent.map((exp) => {
          const cat = getCategoryMeta(exp.category);
          return (
            <Link key={exp.expenseId} to={`/expense/${exp.expenseId}`} className="expense-item">
              <div className="expense-item-icon" style={{ borderLeft: `3px solid ${cat.color}` }}>
                {cat.icon}
              </div>
              <div className="expense-item-body">
                <div className="expense-item-merchant">{exp.merchant}</div>
                <div className="expense-item-meta">{cat.labelAr} · {exp.date}</div>
              </div>
              <div className="expense-item-amount">{formatRiyal(exp.amount)}</div>
            </Link>
          );
        })
      )}

      <Link to="/add" className="fab-add" aria-label="أضف مصروف">+</Link>
    </div>
  );
};

export default Home;
