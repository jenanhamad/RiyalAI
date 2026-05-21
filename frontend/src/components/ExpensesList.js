import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

const ExpensesList = () => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const response = await api.getExpenses();
      setExpenses(response.data.expenses || []);
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to load expenses';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const getCategoryIcon = (category) => {
    const icons = {
      'Food & Dining': '🍕',
      Transportation: '🚗',
      Shopping: '🛍️',
      Entertainment: '🎬',
      Utilities: '💡',
      Healthcare: '🏥',
      Groceries: '🛒',
      Gas: '⛽',
      Other: '📝',
    };
    return icons[category] || '📝';
  };

  const getFilteredAndSortedExpenses = () => {
    let filtered = expenses;

    if (filter !== 'all') {
      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      filtered = expenses.filter((expense) => {
        const expenseDate = new Date(expense.date);
        if (filter === 'week') return expenseDate >= weekAgo;
        if (filter === 'month') return expenseDate >= monthAgo;
        return true;
      });
    }

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'amount':
          return parseFloat(b.amount) - parseFloat(a.amount);
        case 'merchant':
          return a.merchant.localeCompare(b.merchant);
        case 'category':
          return a.category.localeCompare(b.category);
        default:
          return new Date(b.date) - new Date(a.date);
      }
    });
  };

  const calculateStats = () => {
    const filteredExpenses = getFilteredAndSortedExpenses();
    const total = filteredExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount || 0), 0);
    const average = filteredExpenses.length > 0 ? total / filteredExpenses.length : 0;

    const categoryTotals = {};
    filteredExpenses.forEach((expense) => {
      const category = expense.category || 'Other';
      categoryTotals[category] = (categoryTotals[category] || 0) + parseFloat(expense.amount || 0);
    });

    const topCategory = Object.entries(categoryTotals).sort(([, a], [, b]) => b - a)[0];

    return {
      total,
      average,
      count: filteredExpenses.length,
      topCategory: topCategory ? { name: topCategory[0], amount: topCategory[1] } : null,
    };
  };

  if (loading) {
    return (
      <div className="expenses-list-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading your expenses...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="expenses-list-container">
        <div className="error-state">
          <div className="error-icon">⚠️</div>
          <h3>Unable to Load Expenses</h3>
          <p>{error}</p>
          <button className="btn-primary" onClick={fetchExpenses}>Try Again</button>
        </div>
      </div>
    );
  }

  const stats = calculateStats();
  const displayExpenses = getFilteredAndSortedExpenses();

  return (
    <div className="expenses-list-container">
      <div className="dashboard-header">
        <div className="welcome-section">
          <h1>💰 RiyalAI Dashboard</h1>
          <p>Track and manage your spending</p>
        </div>
        <Link to="/upload-receipt" className="btn-primary add-expense-btn">
          <span className="btn-icon">+</span>
          Add Expense
        </Link>
      </div>

      <div className="stats-grid">
        <div className="stat-card total">
          <div className="stat-icon">💰</div>
          <div className="stat-info">
            <h3>Total Spent</h3>
            <p className="stat-value">{formatCurrency(stats.total)}</p>
            <span className="stat-label">{filter === 'all' ? 'All time' : `Last ${filter}`}</span>
          </div>
        </div>
        <div className="stat-card count">
          <div className="stat-icon">📊</div>
          <div className="stat-info">
            <h3>Transactions</h3>
            <p className="stat-value">{stats.count}</p>
            <span className="stat-label">Total expenses</span>
          </div>
        </div>
        <div className="stat-card average">
          <div className="stat-icon">📈</div>
          <div className="stat-info">
            <h3>Average</h3>
            <p className="stat-value">{formatCurrency(stats.average)}</p>
            <span className="stat-label">Per transaction</span>
          </div>
        </div>
        <div className="stat-card category">
          <div className="stat-icon">{stats.topCategory ? getCategoryIcon(stats.topCategory.name) : '📝'}</div>
          <div className="stat-info">
            <h3>Top Category</h3>
            <p className="stat-value">{stats.topCategory ? formatCurrency(stats.topCategory.amount) : '$0.00'}</p>
            <span className="stat-label">{stats.topCategory ? stats.topCategory.name : 'None'}</span>
          </div>
        </div>
      </div>

      <div className="controls-section">
        <div className="filter-controls">
          <label>Filter by:</label>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="filter-select">
            <option value="all">All Time</option>
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
          </select>
        </div>
        <div className="sort-controls">
          <label>Sort by:</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="sort-select">
            <option value="date">Date</option>
            <option value="amount">Amount</option>
            <option value="merchant">Merchant</option>
            <option value="category">Category</option>
          </select>
        </div>
      </div>

      <div className="expenses-section">
        <div className="section-header">
          <h2>Recent Expenses</h2>
          <span className="expense-count">{displayExpenses.length} expenses</span>
        </div>

        {displayExpenses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <h3>No expenses found</h3>
            <p>Start tracking your expenses by adding your first one!</p>
            <Link to="/upload-receipt" className="btn-primary">Add Your First Expense</Link>
          </div>
        ) : (
          <div className="expenses-grid">
            {displayExpenses.map((expense) => (
              <Link key={expense.expenseId} to={`/expense/${expense.expenseId}`} className="expense-card enhanced">
                <div className="expense-header">
                  <div className="expense-category">
                    <span className="category-icon">{getCategoryIcon(expense.category)}</span>
                    <span className="category-name">{expense.category}</span>
                  </div>
                  <div className="expense-amount">{formatCurrency(expense.amount)}</div>
                </div>
                <div className="expense-details">
                  <h4 className="expense-merchant">{expense.merchant}</h4>
                  <p className="expense-date">{formatDate(expense.date)}</p>
                  {expense.description && <p className="expense-description">{expense.description}</p>}
                </div>
                <div className="expense-footer">
                  <div className="payment-method">
                    <span className="payment-icon">💳</span>
                    <span className="payment-name">{expense.paymentMethod || 'Card'}</span>
                  </div>
                  <div className="expense-actions">
                    <span className="view-details">View Details →</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpensesList;
