import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import ProgressRing from './ui/ProgressRing';
import { getCategoryMeta } from '../utils/categories';

const Challenges = ({ user }) => {
  const [challenges, setChallenges] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  const fetchAll = async () => {
    try {
      const [chRes, prRes] = await Promise.all([
        api.getChallenges(),
        api.getProfile(),
      ]);
      setChallenges(chRes.data.challenges || []);
      setProfile(prRes.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await api.generateChallenges();
      await fetchAll();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="page loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page-title">التحديات</h1>
      <p className="page-subtitle">Challenges · مولّدة بالذكاء الاصطناعي</p>

      {profile?.streakWeek && (
        <div className="glass-card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span className="streak-flame">🔥 {profile.streak} أيام</span>
            <span className="text-muted" style={{ fontSize: '0.75rem' }}>السلسلة</span>
          </div>
          <div className="streak-row">
            {profile.streakWeek.map((day) => (
              <div key={day.date} className={`streak-dot ${day.state}`}>
                <div>{day.dayLabelAr?.slice(0, 1)}</div>
                <div>{day.state === 'done' ? '✓' : day.state === 'today' ? '●' : '·'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}

      <button type="button" className="btn-ghost" onClick={handleGenerate} disabled={generating} style={{ marginBottom: 16 }}>
        {generating ? 'جاري التوليد...' : '✦ توليد تحديات AI'}
      </button>

      {challenges.length === 0 ? (
        <div className="empty-state">
          <p>🎯</p>
          <p>ما فيه تحديات حالياً</p>
          <p className="text-muted">كل أحد يجيك تحديات جديدة</p>
        </div>
      ) : (
        challenges.map((ch) => {
          const progress = ch.progressPercent ?? 0;
          const isAi = ch.status === 'active';
          const cat = getCategoryMeta(ch.category);
          return (
            <div
              key={ch.challengeId}
              className={`challenge-card${isAi ? ' ai-active' : ''}`}
            >
              <div className="challenge-card-header">
                <ProgressRing progress={progress} size={56}>
                  {progress}%
                </ProgressRing>
                <div className="challenge-card-body">
                  {isAi && <span className="ai-chip">✦ AI</span>}
                  <h3>{ch.title}</h3>
                  <p className="challenge-desc">{ch.description}</p>
                  <span className="text-muted" style={{ fontSize: '0.7rem' }}>{cat.icon} {cat.labelAr}</span>
                </div>
                <span className="challenge-xp-tag">+{ch.xpReward}</span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default Challenges;
