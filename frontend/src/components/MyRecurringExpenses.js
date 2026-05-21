import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

const MyRecurringExpenses = () => {
  const [recurringExpenses, setRecurringExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRecurringExpenses();
  }, []);

  const fetchRecurringExpenses = async () => {
    try {
      setLoading(true);
      const response = await api.getRecurringExpenses();
      setRecurringExpenses(response.data.recurringExpenses || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load recurring expenses.');
    } finally {
      setLoading(false);
    }
  };

  const toggleRecurring = async (expenseId) => {
    try {
      await api.toggleRecurring(expenseId);
      fetchRecurringExpenses();
    } catch {
      alert('Failed to update recurring status.');
    }
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const getTotalMonthlyAmount = () =>
    recurringExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount || 0), 0);

  if (loading) {
    return (
      <div className="favorites-container">
        <div className="loading">Loading recurring expenses...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="favorites-container">
        <div className="error">{error}</div>
      </div>
    );
  }

  return (
    <div className="favorites-container">
      <div className="favorites-header">
        <h2>🔄 Recurring Expenses</h2>
        <p>Track monthly commitments for better budget planning</p>
      </div>

      {recurringExpenses.length === 0 ? (
        <div className="no-favorites">
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🔄</div>
          <h3>No recurring expenses yet</h3>
          <p>Mark expenses as recurring from the expense detail page.</p>
          <Link to="/" className="browse-btn">Browse Expenses</Link>
        </div>
      ) : (
        <>
          <div className="balance-card" style={{ marginBottom: '2rem' }}>
            <div className="balance-label">Monthly Recurring Total</div>
            <div className="balance-amount">{formatCurrency(getTotalMonthlyAmount())}</div>
            <div className="balance-change">
              {recurringExpenses.length} recurring {recurringExpenses.length === 1 ? 'expense' : 'expenses'}
            </div>
          </div>

          <div className="favorites-grid">
            {recurringExpenses.map((expense) => (
              <div key={expense.expenseId} className="expense-card">
                <div className="expense-header">
                  <div className="category-badge">{expense.category}</div>
                  <div className="expense-amount">{formatCurrency(expense.amount)}</div>
                </div>
                <div className="expense-details">
                  <h3>{expense.merchant}</h3>
                  <p className="expense-date">Last: {formatDate(expense.date)}</p>
                </div>
                <div className="expense-actions">
                  <Link to={`/expense/${expense.expenseId}`} className="view-btn">View Details</Link>
                  <button onClick={() => toggleRecurring(expense.expenseId)} className="btn-secondary">
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default MyRecurringExpenses;
