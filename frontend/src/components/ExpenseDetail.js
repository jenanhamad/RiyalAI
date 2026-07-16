import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { formatRiyal } from '../utils/format';
import { getCategoryMeta } from '../utils/categories';

const ExpenseDetail = () => {
  const { expenseId } = useParams();
  const navigate = useNavigate();
  const [expense, setExpense] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getExpense(expenseId)
      .then((res) => setExpense(res.data))
      .catch((err) => setError(err.response?.data?.error || err.message))
      .finally(() => setLoading(false));
  }, [expenseId]);

  const handleDelete = async () => {
    if (!window.confirm('حذف هذا المصروف؟')) return;
    await api.deleteExpense(expenseId);
    navigate('/');
  };

  const toggleRecurring = async () => {
    await api.toggleRecurring(expenseId);
    const res = await api.getExpense(expenseId);
    setExpense(res.data);
  };

  if (loading) {
    return (
      <div className="page loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  if (error || !expense) {
    return (
      <div className="page">
        <div className="error-banner">{error || 'غير موجود'}</div>
        <Link to="/" className="btn-ghost" style={{ display: 'block', textAlign: 'center', marginTop: 16 }}>← الرئيسية</Link>
      </div>
    );
  }

  const isIncome = expense.entryType === 'income';
  const cat = getCategoryMeta(expense.category, expense.mode || 'personal');

  return (
    <div className="page">
      <Link to="/home" className="text-secondary" style={{ fontSize: '0.85rem', textDecoration: 'none' }}>← رجوع</Link>

      <div className="glass-card xp-hero" style={{ marginTop: 16, textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>{isIncome ? '↑' : cat.icon}</div>
        <h1 className="page-title" style={{ fontSize: '1.25rem' }}>{expense.merchant}</h1>
        <p className="font-mono" style={{ fontSize: '2rem', marginTop: 12 }}>
          {isIncome ? '+' : ''}{formatRiyal(expense.amount)}
        </p>
        <p className="text-secondary" style={{ marginTop: 8 }}>
          {isIncome ? 'إيراد' : cat.labelAr}
          {expense.mode === 'business' ? ' · أعمال' : ''}
          {' · '}{expense.date}
        </p>
      </div>

      <div className="glass-card" style={{ padding: 16, marginTop: 12 }}>
        {expense.projectTag && (
          <p style={{ marginBottom: 12 }}><span className="text-muted">المشروع: </span>{expense.projectTag}</p>
        )}
        {expense.description && (
          <p style={{ marginBottom: 12 }}><span className="text-muted">الوصف: </span>{expense.description}</p>
        )}
        {expense.notes && (
          <p style={{ marginBottom: 12 }}><span className="text-muted">ملاحظات: </span>{expense.notes}</p>
        )}
        <p><span className="text-muted">الدفع: </span>{expense.paymentMethod}</p>
        {expense.isRecurring && <p className="text-green" style={{ marginTop: 8 }}>🔄 مصروف متكرر</p>}
      </div>

      <button type="button" className="btn-ghost" style={{ marginTop: 12 }} onClick={toggleRecurring}>
        {expense.isRecurring ? 'إلغاء التكرار' : 'جعله متكرر'}
      </button>

      <button
        type="button"
        className="btn-ghost"
        style={{ marginTop: 8, color: '#FCA5A5', borderColor: 'rgba(239,68,68,0.4)' }}
        onClick={handleDelete}
      >
        حذف المصروف
      </button>
    </div>
  );
};

export default ExpenseDetail;
