import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import ProgressRing from './ui/ProgressRing';
import { getCategoryMeta } from '../utils/categories';

const Challenges = ({ user }) => {
  const [challenges, setChallenges] = useState([]);
  const [sharedGroups, setSharedGroups] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sharingId, setSharingId] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');

  const fetchAll = async () => {
    try {
      const [chRes, prRes, shRes] = await Promise.all([
        api.getChallenges(),
        api.getProfile(),
        api.getSharedChallenges().catch(() => ({ data: { groups: [] } })),
      ]);
      setChallenges(chRes.data.challenges || []);
      setProfile(prRes.data);
      setSharedGroups(shRes.data.groups || []);
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

  const handleShare = async (challengeId) => {
    setSharingId(challengeId);
    setError('');
    setSuccess('');
    try {
      const res = await api.shareChallenge(challengeId);
      setSuccess(`تمت مشاركة التحدي مع ${res.data.sharedWith} صديق`);
      await fetchAll();
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setSharingId(null);
    }
  };

  if (loading) {
    return (
      <div className="page loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  const personal = challenges.filter((c) => !c.groupId);

  return (
    <div className="page">
      <h1 className="page-title">التحديات</h1>
      <p className="page-subtitle">Challenges · شخصية ومشتركة</p>

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
      {success && <div className="success-banner">{success}</div>}

      {sharedGroups.length > 0 && (
        <>
          <h2 className="section-title">🤝 تحديات مشتركة</h2>
          {sharedGroups.map((group) => {
            const cat = getCategoryMeta(group.category);
            return (
              <div key={group.groupId} className="challenge-card shared-challenge-card">
                <div className="challenge-card-header">
                  <ProgressRing
                    progress={group.members.find((m) => m.isMe)?.progressPercent ?? 0}
                    size={56}
                  >
                    {group.members.find((m) => m.isMe)?.progressPercent ?? 0}%
                  </ProgressRing>
                  <div className="challenge-card-body">
                    <span className="ai-chip">👥 {group.memberCount} مشارك</span>
                    <h3>{group.title}</h3>
                    <p className="challenge-desc">{group.description}</p>
                    <span className="text-muted" style={{ fontSize: '0.7rem' }}>{cat.icon} {cat.labelAr}</span>
                  </div>
                  <span className="challenge-xp-tag">+{group.xpReward}</span>
                </div>
                <div className="shared-members">
                  {group.members.map((m) => (
                    <div key={m.userId} className={`shared-member-row${m.isMe ? ' is-me' : ''}`}>
                      <span>{m.isMe ? `أنت · ${m.displayName}` : m.displayName}</span>
                      <div className="shared-member-bar">
                        <div className="shared-member-fill" style={{ width: `${m.progressPercent}%` }} />
                      </div>
                      <span className="font-mono text-secondary">{m.progressPercent}%</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}

      <h2 className="section-title">تحدياتك</h2>

      <button type="button" className="btn-ghost" onClick={handleGenerate} disabled={generating} style={{ marginBottom: 16 }}>
        {generating ? 'جاري التوليد...' : '✦ توليد تحديات AI'}
      </button>

      {personal.length === 0 ? (
        <div className="empty-state">
          <p>🎯</p>
          <p>ما فيه تحديات حالياً</p>
          <p className="text-muted">كل أحد يجيك تحديات جديدة</p>
        </div>
      ) : (
        personal.map((ch) => {
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
              {ch.status === 'active' && (
                <button
                  type="button"
                  className="btn-outline challenge-share-btn"
                  disabled={sharingId === ch.challengeId}
                  onClick={() => handleShare(ch.challengeId)}
                >
                  {sharingId === ch.challengeId ? '...' : '👥 شارك مع الأصدقاء'}
                </button>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

export default Challenges;
