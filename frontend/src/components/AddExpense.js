import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, uploadReceiptFile } from '../services/api';
import { CATEGORIES } from '../utils/categories';
import { RIYAL } from '../utils/format';

const AddExpense = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    merchant: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    category: 'Food & Dining',
    paymentMethod: 'Digital Wallet',
    description: '',
    notes: '',
  });
  const [receiptFile, setReceiptFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [xpEarned, setXpEarned] = useState(20);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.merchant || !form.amount || parseFloat(form.amount) <= 0) {
      setError('أدخل التاجر والمبلغ');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.createExpense({
        ...form,
        amount: parseFloat(form.amount),
        hasReceipt: !!receiptFile,
      });
      const result = res.data;
      setXpEarned(result.gamification?.xpEarned ?? 20);
      if (receiptFile && result.expenseId) {
        const up = await uploadReceiptFile(result.expenseId, receiptFile);
        await api.updateExpense(result.expenseId, { receiptKey: up.key, hasReceipt: true });
      }
      setSuccess(true);
      setTimeout(() => navigate('/'), 1800);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: 80 }}>
        <div style={{ fontSize: '3rem' }}>✓</div>
        <h2 className="page-title" style={{ marginTop: 16 }}>تم التسجيل!</h2>
        <p className="font-mono text-gold">+{xpEarned} XP</p>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="header-bar">
        <h1 className="page-title">أضف مصروف</h1>
        <Link to="/voice" className="text-green" style={{ fontSize: '0.85rem', textDecoration: 'none' }}>🎤 صوت</Link>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <form onSubmit={handleSubmit}>
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
          <label>التاجر</label>
          <input
            type="text"
            value={form.merchant}
            onChange={(e) => setForm({ ...form, merchant: e.target.value })}
            placeholder="مثال: ستاربكس، بنزين"
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

        <p className="section-title" style={{ marginTop: 8 }}>الفئة</p>
        <div className="category-grid">
          {CATEGORIES.map((cat) => (
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
          {loading ? 'جاري الحفظ...' : 'حفظ المصروف'}
        </button>
      </form>
    </div>
  );
};

export default AddExpense;
