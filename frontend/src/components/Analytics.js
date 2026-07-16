import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { formatRiyal } from '../utils/format';
import { getCategoryMeta } from '../utils/categories';
import ProgressRing from './ui/ProgressRing';
import { useMode } from '../context/ModeContext';
import ModeSwitcher from './ModeSwitcher';

const Analytics = () => {
  const { mode } = useMode();
  const [analytics, setAnalytics] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getAnalytics(mode).catch((err) => {
        setError(err.response?.data?.error || err.message);
        return { data: { totalExpenses: 0, categoryBreakdown: {}, expenseCount: 0 } };
      }),
      api.getExpenses(mode),
    ])
      .then(([aRes, eRes]) => {
        setAnalytics(aRes.data);
        setExpenses(eRes.data.expenses || []);
      })
      .finally(() => setLoading(false));
  }, [mode]);

  if (loading) {
    return (
      <div className="page loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  const breakdown = analytics?.categoryBreakdown || {};
  const total = analytics?.totalExpenses || 1;
  const entries = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);

  const weekBars = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const sum = expenses
        .filter((e) => e.date?.startsWith(key))
        .reduce((s, e) => s + parseFloat(e.amount || 0), 0);
      days.push({ label: d.toLocaleDateString('ar-SA', { weekday: 'narrow' }), sum, key });
    }
    const max = Math.max(...days.map((d) => d.sum), 1);
    const maxIdx = days.reduce((bi, d, i, arr) => (d.sum > arr[bi].sum ? i : bi), 0);
    return { days, max, maxIdx };
  };

  const { days, max, maxIdx } = weekBars();

  const topCat = entries[0];
  const insight = topCat
    ? `أكثر إنفاقك على ${getCategoryMeta(topCat[0], mode).labelAr} — ${Math.round((topCat[1] / total) * 100)}% من مصروفاتك.`
    : 'ابدأ بتسجيل مصروفاتك عشان تشوف تحليلات ذكية هنا.';

  return (
    <div className="page">
      <h1 className="page-title">التحليلات</h1>
      <p className="page-subtitle">{mode === 'business' ? 'تحليل أعمال' : 'Analytics'}</p>
      <ModeSwitcher compact />
      {error && <div className="error-banner">{error}</div>}

      <div className="quick-stats">
        <div className="stat-mini glass-card">
          <div className="stat-mini-label">إجمالي المصروف</div>
          <div className="stat-mini-value">{formatRiyal(analytics?.totalExpenses || 0)}</div>
        </div>
        <div className="stat-mini glass-card">
          <div className="stat-mini-label">العمليات</div>
          <div className="stat-mini-value">{analytics?.expenseCount || 0}</div>
        </div>
      </div>

      <h2 className="section-title">توزيع الإنفاق</h2>
      <div className="ring-chart-row glass-card" style={{ padding: 20 }}>
        {entries.slice(0, 4).map(([cat, amt]) => {
          const pct = Math.round((amt / total) * 100);
          const meta = getCategoryMeta(cat, mode);
          return (
            <div key={cat} className="spend-ring-item">
              <ProgressRing progress={pct} size={64}>
                <span style={{ color: meta.color }}>{pct}%</span>
              </ProgressRing>
              <div className="spend-ring-label">{meta.icon} {meta.labelAr}</div>
            </div>
          );
        })}
      </div>

      <h2 className="section-title">آخر ٧ أيام</h2>
      <div className="glass-card" style={{ padding: 16 }}>
        <div className="bar-chart">
          {days.map((d, i) => (
            <div key={d.key} className="bar-col">
              <div
                className={`bar${i === maxIdx ? ' highlight' : ''}`}
                style={{ height: `${Math.max(4, (d.sum / max) * 100)}%` }}
              />
              <span className="bar-label">{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="ai-insight-card">
        <span className="ai-chip">✦ AI Insight</span>
        <p style={{ marginTop: 8 }}>{insight}</p>
      </div>
    </div>
  );
};

export default Analytics;
