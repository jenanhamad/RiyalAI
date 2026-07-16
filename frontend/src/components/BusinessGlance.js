import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { formatRiyal } from '../utils/format';
import { getCategoryMeta } from '../utils/categories';
import ModeSwitcher from './ModeSwitcher';

const severityLabel = { high: 'عالي', medium: 'متوسط', low: 'منخفض' };

const BusinessGlance = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getBusinessGlance()
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.detail || err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="page loading-screen">
        <div className="spinner" />
        <p>نجهّز نظرة على مشروعك...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page">
        <div className="error-banner">{error || 'تعذر التحميل'}</div>
        <Link to="/home" className="btn-ghost" style={{ display: 'block', textAlign: 'center' }}>← لوحة العمل</Link>
      </div>
    );
  }

  const { profit, week, health, vat, dayBars, topCategories, topProjects, leaks, insight } = data;
  const maxBar = Math.max(
    ...dayBars.map((d) => Math.max(d.income, d.expenses)),
    1,
  );
  const tone = insight?.tone || 'neutral';

  return (
    <div className="page glance-page">
      <div className="header-bar">
        <div>
          <p className="tagline">{data.title || 'Your business at a glance'}</p>
          <h1 className="page-title">{data.titleAr || 'مشروعك بنظرة'}</h1>
        </div>
        <Link to="/home" className="text-secondary" style={{ textDecoration: 'none', fontSize: '0.85rem' }}>رجوع</Link>
      </div>

      <ModeSwitcher compact />

      <div className={`glass-card glance-insight tone-${tone}`}>
        <div className="glance-insight-top">
          <span className="ai-chip">{insight?.source === 'ai' ? '✦ AI' : 'نظرة'}</span>
          <h2>{insight?.headlineAr || insight?.headline}</h2>
        </div>
        <p className="glance-insight-text">{insight?.insightAr}</p>
        {insight?.focus && (
          <p className="glance-focus">التركيز: {insight.focus}</p>
        )}
      </div>

      <div className="biz-profit-grid">
        <div className="glass-card biz-stat">
          <p className="text-secondary">إيراد 30 يوم</p>
          <p className="font-mono biz-stat-value income">{formatRiyal(profit.income)}</p>
        </div>
        <div className="glass-card biz-stat">
          <p className="text-secondary">مصروف 30 يوم</p>
          <p className="font-mono biz-stat-value expense">{formatRiyal(profit.expenses)}</p>
        </div>
        <div className="glass-card biz-stat">
          <p className="text-secondary">ربح / هامش</p>
          <p className={`font-mono biz-stat-value ${profit.profit >= 0 ? 'income' : 'expense'}`}>
            {formatRiyal(profit.profit)}
          </p>
          <p className="text-secondary" style={{ fontSize: '0.75rem', marginTop: 4 }}>
            {profit.marginPercent}%
          </p>
        </div>
        <div className="glass-card biz-stat">
          <p className="text-secondary">صحة المشروع</p>
          <p className="font-mono biz-stat-value">{health.score}/100</p>
          <p className="text-secondary" style={{ fontSize: '0.75rem', marginTop: 4 }}>
            {health.labelAr}
          </p>
        </div>
      </div>

      <div className="glass-card glance-week-strip">
        <p className="text-secondary" style={{ fontSize: '0.8rem' }}>هذا الأسبوع</p>
        <div className="glance-week-nums">
          <span>إيراد {formatRiyal(week.income)}</span>
          <span>مصروف {formatRiyal(week.expenses)}</span>
          <span className={week.profit >= 0 ? 'income' : 'expense'}>
            ربح {formatRiyal(week.profit)}
          </span>
        </div>
      </div>

      <h2 className="section-title">آخر 7 أيام</h2>
      <div className="glass-card glance-bars">
        {dayBars.map((d) => (
          <div key={d.date} className="glance-bar-col">
            <div className="glance-bar-pair">
              <div
                className="glance-bar income"
                style={{ height: `${Math.max(4, (d.income / maxBar) * 100)}%` }}
                title={`إيراد ${d.income}`}
              />
              <div
                className="glance-bar expense"
                style={{ height: `${Math.max(4, (d.expenses / maxBar) * 100)}%` }}
                title={`مصروف ${d.expenses}`}
              />
            </div>
            <span className="story-bar-label">{d.labelAr}</span>
          </div>
        ))}
        <div className="glance-bar-legend">
          <span><i className="dot income" /> إيراد</span>
          <span><i className="dot expense" /> مصروف</span>
        </div>
      </div>

      {topCategories.length > 0 && (
        <>
          <h2 className="section-title">أعلى مصروفات</h2>
          <div className="glass-card" style={{ padding: '8px 16px' }}>
            {topCategories.map((c) => {
              const meta = getCategoryMeta(c.category, 'business');
              const pct = profit.expenses > 0
                ? Math.round((c.amount / profit.expenses) * 100)
                : 0;
              return (
                <div key={c.category} className="biz-project-row">
                  <span>{meta.icon} {meta.labelAr}</span>
                  <span className="font-mono">
                    {formatRiyal(c.amount)}
                    <span className="text-secondary" style={{ marginInlineStart: 6, fontSize: '0.75rem' }}>
                      {pct}%
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {topProjects.length > 0 && (
        <>
          <h2 className="section-title">حسب المشروع</h2>
          <div className="glass-card" style={{ padding: '8px 16px' }}>
            {topProjects.map((p) => (
              <div key={p.tag} className="biz-project-row">
                <span>{p.tag}</span>
                <span className="font-mono">{formatRiyal(p.amount)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="glass-card biz-vat-card" style={{ marginTop: 16 }}>
        <div className="biz-vat-header">
          <h2 className="section-title" style={{ margin: 0 }}>VAT تقديري</h2>
          <span className="ai-chip">تقديري</span>
        </div>
        <p className="font-mono" style={{ fontSize: '1.2rem', margin: '8px 0' }}>
          {formatRiyal(vat.vatRecoverableEstimate || 0)}
        </p>
        {vat.missingReceiptCount > 0 && (
          <p className="biz-warning">{vat.missingReceiptCount} بدون إيصال</p>
        )}
        <p className="text-secondary" style={{ fontSize: '0.7rem', marginTop: 8 }}>
          {vat.disclaimerAr}
        </p>
      </div>

      {leaks.length > 0 && (
        <>
          <h2 className="section-title">نقاط انتباه</h2>
          {leaks.map((leak, i) => (
            <div key={`${leak.title}-${i}`} className={`glass-card leak-card severity-${leak.severity || 'medium'}`}>
              <div className="leak-card-top">
                <h3>{leak.title}</h3>
                <span className="leak-severity">{severityLabel[leak.severity] || leak.severity}</span>
              </div>
              {leak.amount != null && (
                <p className="font-mono text-gold">{formatRiyal(leak.amount)}</p>
              )}
              <p className="text-secondary" style={{ fontSize: '0.85rem' }}>{leak.suggestion}</p>
            </div>
          ))}
        </>
      )}

      {(health.tips || []).length > 0 && (
        <div className="glass-card" style={{ padding: 16, marginBottom: 24 }}>
          <p className="text-secondary" style={{ fontSize: '0.8rem', marginBottom: 8 }}>نصائح سريعة</p>
          {health.tips.map((tip) => (
            <p key={tip} className="biz-tip">• {tip}</p>
          ))}
        </div>
      )}
    </div>
  );
};

export default BusinessGlance;
