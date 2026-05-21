import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

const ExpenseDetail = () => {
  const { expenseId } = useParams();
  const navigate = useNavigate();
  const [expense, setExpense] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchExpense();
  }, [expenseId]);

  const fetchExpense = async () => {
    try {
      setLoading(true);
      const response = await api.getExpense(expenseId);
      setExpense(response.data);
    } catch (err) {
      if (err.response?.status === 404) {
        setError('Expense not found');
      } else {
        setError(err.response?.data?.error || 'Failed to load expense details.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;
    try {
      await api.deleteExpense(expenseId);
      navigate('/');
    } catch {
      alert('Failed to delete expense. Please try again.');
    }
  };

  const toggleRecurring = async () => {
    try {
      const response = await api.toggleRecurring(expenseId);
      setExpense((prev) => ({ ...prev, isRecurring: response.data.isRecurring }));
    } catch {
      alert('Failed to update recurring status. Please try again.');
    }
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const getCategoryIcon = (category) => {
    const icons = {
      'Food & Dining': '🍕', Transportation: '🚗', Shopping: '🛍️', Entertainment: '🎬',
      Utilities: '💡', Healthcare: '🏥', Groceries: '🛒', Gas: '⛽', Other: '📝',
    };
    return icons[category] || '📝';
  };

  if (loading) {
    return (
      <div className="expense-detail-container">
        <div className="loading">Loading expense details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="expense-detail-container">
        <div className="error">{error}</div>
        <button onClick={() => navigate('/')} className="back-btn">← Back to Dashboard</button>
      </div>
    );
  }

  return (
    <div className="expense-detail-container">
      <div className="expense-detail-header">
        <button onClick={() => navigate('/')} className="back-btn">← Back to Dashboard</button>
        <button onClick={handleDelete} className="delete-btn">🗑️ Delete</button>
      </div>

      <div className="expense-detail-card">
        {expense.isRecurring && (
          <div className="recurring-badge">🔄 Recurring Monthly Expense</div>
        )}

        <div className="expense-main-info">
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>{getCategoryIcon(expense.category)}</div>
          <div className="expense-amount-large">{formatCurrency(expense.amount)}</div>
          <div className="expense-merchant">{expense.merchant || 'Unknown Merchant'}</div>
          <div className="expense-date">{formatDate(expense.date)}</div>
          <div className="category-badge">{getCategoryIcon(expense.category)} {expense.category}</div>
        </div>

        <div className="expense-details-grid">
          <div className="detail-item">
            <label>Payment Method</label>
            <div>{expense.paymentMethod || 'Not specified'}</div>
          </div>
          <div className="detail-item">
            <label>Status</label>
            <div>{expense.status || 'processed'}</div>
          </div>
          {expense.description && (
            <div className="detail-item full-width">
              <label>Description</label>
              <div>{expense.description}</div>
            </div>
          )}
          {expense.notes && (
            <div className="detail-item full-width">
              <label>Notes</label>
              <div>{expense.notes}</div>
            </div>
          )}
        </div>

        {expense.hasReceipt && (
          <div className="receipt-section">
            <h3>📄 Receipt Available</h3>
            {expense.extractedMerchant && (
              <div className="extracted-info">
                <div>Merchant: {expense.extractedMerchant}</div>
                {expense.extractedAmount && <div>Amount: {formatCurrency(expense.extractedAmount)}</div>}
                {expense.extractedDate && <div>Date: {expense.extractedDate}</div>}
              </div>
            )}
          </div>
        )}

        <div className="expense-actions-row">
          <button onClick={toggleRecurring} className="btn-primary">
            {expense.isRecurring ? '❌ Remove Recurring' : '🔄 Mark Recurring'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExpenseDetail;
