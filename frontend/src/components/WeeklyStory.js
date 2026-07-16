import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { formatRiyal } from '../utils/format';
import { getCategoryMeta } from '../utils/categories';
import ModeSwitcher from './ModeSwitcher';

const moodEmoji = {
  up: '✨',
  steady: '🌱',
  down: '👀',
  calm: '🌙',
};

const WeeklyStory = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [shareNote, setShareNote] = useState('');

  useEffect(() => {
    api.getWeeklyStory()
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.detail || err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleShare = async () => {
    const caption = data?.story?.shareCaption
      || (data?.story?.sentences || []).slice(0, 2).join(' · ');
    const text = `${data?.story?.title || 'قصة أسبوعي'}\n${caption}\n— ريالي`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'قصة أسبوعي · ريالي', text });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setShareNote('تم نسخ القصة');
        setTimeout(() => setShareNote(''), 2000);
      }
    } catch {
      // user cancelled
    }
  };

  if (loading) {
    return (
      <div className="page loading-screen">
        <div className="spinner" />
        <p>نكتب قصة أسبوعك...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page">
        <div className="error-banner">{error || 'تعذر التحميل'}</div>
        <Link to="/home" className="btn-ghost" style={{ display: 'block', textAlign: 'center' }}>← الرئيسية</Link>
      </div>
    );
  }

  const { stats, story } = data;
  const maxBar = Math.max(...(stats.dayBars || []).map((d) => d.amount), 1);
  const topCat = stats.topCategory ? getCategoryMeta(stats.topCategory) : null;

  return (
    <div className="page story-page">
      <div className="header-bar">
        <div>
          <p className="tagline">Weekly Story</p>
          <h1 className="page-title">قصة أسبوعك</h1>
        </div>
        <Link to="/home" className="text-secondary" style={{ textDecoration: 'none', fontSize: '0.85rem' }}>رجوع</Link>
      </div>

      <ModeSwitcher compact />

      <div className={`story-hero mood-${story.mood || 'steady'}`}>
        <span className="story-mood">{moodEmoji[story.mood] || '✨'}</span>
        <h2 className="story-title">{story.title}</h2>
        <p className="text-secondary story-range">
          {stats.weekStart} → {stats.weekEnd}
          {story.source === 'ai' && <span className="ai-chip" style={{ marginInlineStart: 8 }}>✦ AI</span>}
        </p>
        <div className="story-sentences">
          {(story.sentences || []).map((s) => (
            <p key={s} className="story-sentence">{s}</p>
          ))}
        </div>
        <button type="button" className="btn-primary story-share-btn" onClick={handleShare}>
          مشاركة القصة
        </button>
        {shareNote && <p className="text-green" style={{ marginTop: 8, fontSize: '0.85rem' }}>{shareNote}</p>}
      </div>

      <div className="biz-profit-grid">
        <div className="glass-card biz-stat">
          <p className="text-secondary">إنفاق الأسبوع</p>
          <p className="font-mono biz-stat-value">{formatRiyal(stats.totalSpent)}</p>
        </div>
        <div className="glass-card biz-stat">
          <p className="text-secondary">مقابل السابق</p>
          <p className={`font-mono biz-stat-value ${(stats.deltaAmount || 0) <= 0 ? 'income' : 'expense'}`}>
            {(stats.deltaAmount || 0) > 0 ? '+' : ''}{formatRiyal(stats.deltaAmount || 0)}
          </p>
        </div>
        <div className="glass-card biz-stat">
          <p className="text-secondary">عمليات</p>
          <p className="font-mono biz-stat-value">{stats.expenseCount}</p>
        </div>
        <div className="glass-card biz-stat">
          <p className="text-secondary">XP أسبوعي</p>
          <p className="font-mono biz-stat-value">{stats.weeklyXp}</p>
        </div>
      </div>

      <h2 className="section-title">أيام الأسبوع</h2>
      <div className="glass-card story-bars">
        {(stats.dayBars || []).map((d) => (
          <div key={d.date} className="story-bar-col">
            <div className="story-bar-track">
              <div
                className="story-bar-fill"
                style={{ height: `${Math.max(8, (d.amount / maxBar) * 100)}%` }}
              />
            </div>
            <span className="story-bar-label">{d.labelAr}</span>
          </div>
        ))}
      </div>

      {topCat && (
        <div className="glass-card" style={{ padding: 16, marginTop: 12 }}>
          <p className="text-secondary" style={{ fontSize: '0.8rem' }}>أكثر فئة</p>
          <p style={{ marginTop: 6, fontWeight: 700 }}>
            {topCat.icon} {topCat.labelAr}
            <span className="font-mono" style={{ marginInlineStart: 8 }}>
              {formatRiyal(stats.topCategoryAmount)}
            </span>
          </p>
        </div>
      )}
    </div>
  );
};

export default WeeklyStory;
