import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { formatRiyal, getGreeting } from '../utils/format';
import { getCategoryMeta } from '../utils/categories';
import ModeSwitcher from './ModeSwitcher';
import BrandLogo from './BrandLogo';
import { useMode } from '../context/ModeContext';

const severityLabel = {
  high: 'عالي',
  medium: 'متوسط',
  low: 'منخفض',
};

const BusinessHome = ({ user, onSignOut }) => {
  const { mode } = useMode();
  const [dash, setDash] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [leaksSource, setLeaksSource] = useState('rules');

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [dRes, eRes, lRes] = await Promise.all([
        api.getBusinessDashboard(),
        api.getExpenses('business'),
        api.getBusinessLeaks().catch(() => ({ data: { leaks: [], source: 'rules' } })),
      ]);
      const data = dRes.data;
      if (lRes.data?.leaks?.length) {
        data.leaks = lRes.data.leaks;
        setLeaksSource(lRes.data.source || 'ai');
      }
      setDash(data);
      setExpenses(eRes.data.expenses || []);
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData, mode]);

  if (loading) {
    return (
      <div className="page loading-screen">
        <div className="spinner" />
        <p>جاري تحميل لوحة الأعمال...</p>
      </div>
    );
  }

  const profit = dash?.profit || {};
  const health = dash?.health || {};
  const vat = dash?.vat || {};
  const leaks = dash?.leaks || [];
  const recent = [...expenses]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6);

  return (
    <div className="page">
      {error && <div className="error-banner">{error}</div>}

      <div className="header-bar">
        <div className="brand-header">
          <BrandLogo compact />
          <div>
            <p className="tagline">ريالي أعمال</p>
            <h1 className="page-title">{getGreeting()}، {user.username}</h1>
          </div>
        </div>
        <div className="biz-header-actions">
          <Link to="/import-export" className="biz-import-export-btn" aria-label="استيراد وتصدير">⇄</Link>
          <button type="button" className="sign-out-btn" onClick={onSignOut}>خروج</button>
        </div>
      </div>

      <ModeSwitcher />

      <Link to="/glance" className="glass-card story-teaser glance-teaser">
        <div>
          <span className="ai-chip">At a glance</span>
          <h3 style={{ marginTop: 8 }}>مشروعك بنظرة</h3>
          <p className="text-secondary" style={{ fontSize: '0.85rem', marginTop: 4 }}>
            Your business at a glance — ربح، صحة، VAT، هدر
          </p>
        </div>
        <span className="story-teaser-arrow">←</span>
      </Link>

      <div className="biz-health-card glass-card">
        <div className="biz-health-top">
          <div>
            <p className="text-secondary">صحة المشروع</p>
            <h2 className="font-mono">{health.score ?? 0}/100</h2>
            <p className="biz-health-label">{health.labelAr}</p>
          </div>
          <div className="biz-health-ring" style={{ '--score': health.score || 0 }}>
            <span>{health.score ?? 0}</span>
          </div>
        </div>
        {(health.tips || []).slice(0, 2).map((tip) => (
          <p key={tip} className="biz-tip">• {tip}</p>
        ))}
      </div>

      <div className="biz-profit-grid">
        <div className="glass-card biz-stat">
          <p className="text-secondary">إيرادات الشهر</p>
          <p className="font-mono biz-stat-value income">{formatRiyal(profit.income || 0)}</p>
        </div>
        <div className="glass-card biz-stat">
          <p className="text-secondary">مصروفات الشهر</p>
          <p className="font-mono biz-stat-value expense">{formatRiyal(profit.expenses || 0)}</p>
        </div>
        <div className="glass-card biz-stat wide">
          <p className="text-secondary">ربح تقريبي · هامش {profit.marginPercent ?? 0}%</p>
          <p className={`font-mono biz-stat-value ${(profit.profit || 0) >= 0 ? 'income' : 'expense'}`}>
            {formatRiyal(profit.profit || 0)}
          </p>
          <div className="biz-period-row">
            <span>اليوم: {formatRiyal(profit.today?.profit || 0)}</span>
            <span>الأسبوع: {formatRiyal(profit.week?.profit || 0)}</span>
          </div>
        </div>
      </div>

      <div className="glass-card biz-vat-card">
        <div className="biz-vat-header">
          <h2 className="section-title" style={{ margin: 0 }}>جاهزية الضريبة</h2>
          <span className="ai-chip">تقديري</span>
        </div>
        <p className="font-mono" style={{ fontSize: '1.25rem', margin: '8px 0' }}>
          {formatRiyal(vat.vatRecoverableEstimate || 0)}
        </p>
        <p className="text-secondary" style={{ fontSize: '0.8rem' }}>
          تقدير VAT قابل للاسترداد من مصروفات مؤهلة (~{Math.round((vat.vatRate || 0.15) * 100)}%)
        </p>
        {vat.missingReceiptCount > 0 && (
          <p className="biz-warning">
            {vat.missingReceiptCount} مصروفات بدون إيصال
          </p>
        )}
        <p className="text-secondary" style={{ fontSize: '0.7rem', marginTop: 8 }}>
          {vat.disclaimerAr}
        </p>
      </div>

      {leaks.length > 0 && (
        <>
          <h2 className="section-title">
            <span>كاشف الهدر التشغيلي</span>
            <span className="ai-chip">{leaksSource === 'ai' ? '✦ AI' : 'تحليل'}</span>
          </h2>
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

      {Object.keys(profit.projectBreakdown || {}).length > 0 && (
        <>
          <h2 className="section-title">حسب المشروع</h2>
          <div className="glass-card">
            {Object.entries(profit.projectBreakdown).slice(0, 5).map(([tag, amt]) => (
              <div key={tag} className="biz-project-row">
                <span>{tag}</span>
                <span className="font-mono">{formatRiyal(amt)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="section-title">آخر الحركات</h2>
      {recent.length === 0 ? (
        <div className="empty-state">
          <p>ما سجّيت حركات عمل بعد</p>
          <p>سجّل إيراد أو مصروف بالصوت</p>
        </div>
      ) : (
        recent.map((exp) => {
          const cat = getCategoryMeta(exp.category, 'business');
          const isIncome = exp.entryType === 'income';
          return (
            <Link key={exp.expenseId} to={`/expense/${exp.expenseId}`} className="expense-item">
              <div
                className={`expense-item-icon${isIncome ? ' income' : ''}`}
                style={!isIncome ? { borderLeft: `3px solid ${cat.color}` } : undefined}
              >
                {isIncome ? '↑' : cat.icon}
              </div>
              <div className="expense-item-body">
                <div className="expense-item-merchant">{exp.merchant}</div>
                <div className="expense-item-meta">
                  {isIncome ? 'إيراد' : cat.labelAr}
                  {exp.projectTag ? ` · ${exp.projectTag}` : ''}
                  {' · '}{exp.date}
                </div>
              </div>
              <div className={`expense-item-amount ${isIncome ? 'income' : ''}`}>
                {isIncome ? '+' : ''}{formatRiyal(exp.amount)}
              </div>
            </Link>
          );
        })
      )}

      <div className="home-fabs">
        <Link to="/add" className="fab-add" aria-label="أضف حركة">+</Link>
      </div>
    </div>
  );
};

export default BusinessHome;
