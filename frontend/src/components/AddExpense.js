import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, uploadReceiptFile } from '../services/api';
import { getCategoriesForMode } from '../utils/categories';
import { RIYAL } from '../utils/format';
import { useMode } from '../context/ModeContext';
import ModeSwitcher from './ModeSwitcher';

const AddExpense = () => {
  const navigate = useNavigate();
  const { mode, isBusiness } = useMode();
  const categories = getCategoriesForMode(mode);
  const [form, setForm] = useState({
    merchant: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    category: isBusiness ? 'Inventory' : 'Food & Dining',
    paymentMethod: 'Digital Wallet',
    description: '',
    notes: '',
    entryType: 'expense',
    projectTag: '',
  });

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      category: isBusiness ? 'Inventory' : 'Food & Dining',
      entryType: isBusiness ? prev.entryType : 'expense',
    }));
  }, [isBusiness]);
  const [receiptFile, setReceiptFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [xpEarned, setXpEarned] = useState(0);
  const [personalPrompt, setPersonalPrompt] = useState(null);
  const [converting, setConverting] = useState(false);
  const [convertMsg, setConvertMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.merchant || !form.amount || parseFloat(form.amount) <= 0) {
      setError(isBusiness ? 'أدخل الوصف والمبلغ' : 'أدخل التاجر والمبلغ');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.createExpense({
        merchant: form.merchant,
        amount: parseFloat(form.amount),
        date: form.date,
        category: form.category,
        paymentMethod: form.paymentMethod,
        description: form.description,
        notes: form.notes,
        hasReceipt: !!receiptFile,
        mode,
        entryType: isBusiness ? form.entryType : 'expense',
        projectTag: isBusiness ? form.projectTag : '',
      });
      const result = res.data;
      setXpEarned(result.gamification?.xpEarned ?? 0);
      if (receiptFile && result.expenseId) {
        const up = await uploadReceiptFile(result.expenseId, receiptFile);
        await api.updateExpense(result.expenseId, { receiptKey: up.key, hasReceipt: true });
      }
      setSuccess(true);
      if (result.suggestPersonal && result.expenseId) {
        setPersonalPrompt({
          expenseId: result.expenseId,
          promptAr: result.personalSuggestion?.promptAr
            || 'يبدو مصروف شخصي. تبي أحوله لك لمصروف أفراد؟',
        });
      } else {
        setTimeout(() => navigate(isBusiness ? '/home' : '/'), 1800);
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConvertPersonal = async () => {
    if (!personalPrompt?.expenseId || converting) return;
    setConverting(true);
    try {
      const res = await api.convertToPersonal(personalPrompt.expenseId);
      setConvertMsg(res.data.messageAr || 'تم التحويل');
      setPersonalPrompt(null);
      setTimeout(() => navigate('/home'), 1600);
    } catch (err) {
      setError(err.response?.data?.detail || 'تعذر التحويل');
    } finally {
      setConverting(false);
    }
  };

  if (success) {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: 80 }}>
        <div style={{ fontSize: '3rem' }}>✓</div>
        <h2 className="page-title" style={{ marginTop: 16 }}>تم التسجيل!</h2>
        {!isBusiness && xpEarned > 0 && (
          <p className="font-mono text-gold">+{xpEarned} XP</p>
        )}
        {isBusiness && !personalPrompt && !convertMsg && (
          <p className="text-secondary">
            {form.entryType === 'income' ? 'إيراد' : 'مصروف'} عمل محفوظ
          </p>
        )}
        {convertMsg && <p className="text-green" style={{ marginTop: 12 }}>{convertMsg}</p>}
        {personalPrompt && (
          <div className="glass-card personal-convert-card" style={{ textAlign: 'start', marginTop: 24 }}>
            <p className="personal-convert-title">مصروف شخصي؟</p>
            <p className="text-secondary personal-convert-text">{personalPrompt.promptAr}</p>
            <div className="personal-convert-actions">
              <button type="button" className="btn-primary" onClick={handleConvertPersonal} disabled={converting}>
                {converting ? '...' : 'إيوه، حوّلها لأفراد'}
              </button>
              <button
                type="button"
                className="btn-outline"
                onClick={() => navigate('/home')}
                disabled={converting}
              >
                لا، تبقى أعمال
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page">
      <div className="header-bar">
        <h1 className="page-title">{isBusiness ? 'أضف حركة' : 'أضف مصروف'}</h1>
        <Link to="/" className="text-green" style={{ fontSize: '0.85rem', textDecoration: 'none' }}>🎤 صوت</Link>
      </div>

      <ModeSwitcher compact />

      {error && <div className="error-banner">{error}</div>}

      <form onSubmit={handleSubmit}>
        {isBusiness && (
          <div className="mode-switcher" style={{ marginBottom: 16 }}>
            <button
              type="button"
              className={`mode-switch-btn${form.entryType === 'expense' ? ' active' : ''}`}
              onClick={() => setForm({ ...form, entryType: 'expense' })}
            >
              مصروف
            </button>
            <button
              type="button"
              className={`mode-switch-btn${form.entryType === 'income' ? ' active' : ''}`}
              onClick={() => setForm({ ...form, entryType: 'income' })}
            >
              إيراد
            </button>
          </div>
        )}

        <div className="amount-input-wrap">
          <span className="riyal-symbol">{RIYAL}</span>
          <input
            type="number"
            className="amount-input"
            placeholder="0"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            step="0.01"
            min="0"
            required
          />
        </div>

        <div className="form-field">
          <label>{isBusiness ? (form.entryType === 'income' ? 'العميل / المصدر' : 'المورد / الوصف') : 'التاجر'}</label>
          <input
            type="text"
            value={form.merchant}
            onChange={(e) => setForm({ ...form, merchant: e.target.value })}
            placeholder={isBusiness ? 'مثال: جملة، عميل أحمد' : 'مثال: ستاربكس، بنزين'}
            required
          />
        </div>

        <div className="form-field">
          <label>التاريخ</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </div>

        {isBusiness && (
          <div className="form-field">
            <label>مشروع / عميل (اختياري)</label>
            <input
              type="text"
              value={form.projectTag}
              onChange={(e) => setForm({ ...form, projectTag: e.target.value })}
              placeholder="مثال: مشروع أحمد"
            />
          </div>
        )}

        {form.entryType !== 'income' && (
          <>
            <p className="section-title" style={{ marginTop: 8 }}>الفئة</p>
            <div className="category-grid">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`category-chip${form.category === cat.id ? ' selected' : ''}`}
                  style={{ '--chip-color': cat.color }}
                  onClick={() => setForm({ ...form, category: cat.id })}
                >
                  <span className="category-chip-icon">{cat.icon}</span>
                  <span>{cat.labelAr}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <div className="form-field" style={{ marginTop: 16 }}>
          <label>وصف (اختياري)</label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>

        <div className="form-field">
          <label>إيصال (اختياري)</label>
          <input type="file" accept="image/*" onChange={(e) => setReceiptFile(e.target.files[0])} />
        </div>

        <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: 24 }}>
          {loading ? 'جاري الحفظ...' : (isBusiness ? 'حفظ الحركة' : 'حفظ المصروف')}
        </button>
      </form>
    </div>
  );
};

export default AddExpense;
