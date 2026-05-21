import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, uploadReceiptFile } from '../services/api';

const UploadReceipt = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    merchant: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    category: 'Food & Dining',
    paymentMethod: 'Credit Card',
    description: '',
    notes: '',
  });
  const [receiptFile, setReceiptFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const categories = [
    { name: 'Food & Dining', icon: '🍕' },
    { name: 'Transportation', icon: '🚗' },
    { name: 'Shopping', icon: '🛍️' },
    { name: 'Entertainment', icon: '🎬' },
    { name: 'Utilities', icon: '💡' },
    { name: 'Healthcare', icon: '🏥' },
    { name: 'Groceries', icon: '🛒' },
    { name: 'Gas', icon: '⛽' },
    { name: 'Other', icon: '📝' },
  ];

  const paymentMethods = [
    { name: 'Credit Card', icon: '💳' },
    { name: 'Debit Card', icon: '💳' },
    { name: 'Cash', icon: '💵' },
    { name: 'Check', icon: '📝' },
    { name: 'Digital Wallet', icon: '📱' },
    { name: 'Bank Transfer', icon: '🏦' },
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      setError('Please select a valid image file (JPEG, PNG, or GIF)');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setReceiptFile(file);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.merchant || !formData.amount) {
      setError('Please fill in merchant name and amount');
      return;
    }
    if (isNaN(parseFloat(formData.amount)) || parseFloat(formData.amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const expenseData = {
        ...formData,
        amount: parseFloat(formData.amount),
        hasReceipt: !!receiptFile,
      };

      const response = await api.createExpense(expenseData);
      const result = response.data;

      if (receiptFile && result.expenseId) {
        try {
          const uploadResult = await uploadReceiptFile(result.expenseId, receiptFile);
          await api.updateExpense(result.expenseId, { receiptKey: uploadResult.key, hasReceipt: true });
        } catch (uploadError) {
          console.warn('Receipt upload failed, expense was still created:', uploadError);
        }
      }

      setSuccess(true);
      setTimeout(() => navigate('/'), 2000);
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to create expense.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="upload-receipt-container">
        <div className="success-message">
          <div className="success-icon">✅</div>
          <h2>Expense Created Successfully!</h2>
          <p>Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="upload-receipt-container">
      <div className="upload-receipt-card">
        <div className="upload-receipt-header">
          <h1>Add New Expense</h1>
          <p>Track your spending with RiyalAI</p>
        </div>

        <form onSubmit={handleSubmit} className="upload-receipt-form">
          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}

          <div className="form-section">
            <h3>Basic Information</h3>
            <div className="form-group">
              <label htmlFor="merchant">Merchant Name *</label>
              <input
                type="text"
                id="merchant"
                name="merchant"
                value={formData.merchant}
                onChange={handleInputChange}
                placeholder="e.g., Starbucks, Amazon"
                required
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="amount">Amount *</label>
                <div className="amount-input">
                  <span className="currency-symbol">$</span>
                  <input
                    type="number"
                    id="amount"
                    name="amount"
                    value={formData.amount}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="date">Date</label>
                <input type="date" id="date" name="date" value={formData.date} onChange={handleInputChange} />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Category</h3>
            <div className="category-grid">
              {categories.map((category) => (
                <button
                  key={category.name}
                  type="button"
                  className={`category-button ${formData.category === category.name ? 'selected' : ''}`}
                  onClick={() => setFormData((prev) => ({ ...prev, category: category.name }))}
                >
                  <span className="category-icon">{category.icon}</span>
                  <span className="category-name">{category.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="form-section">
            <h3>Payment Method</h3>
            <div className="payment-grid">
              {paymentMethods.map((method) => (
                <button
                  key={method.name}
                  type="button"
                  className={`payment-button ${formData.paymentMethod === method.name ? 'selected' : ''}`}
                  onClick={() => setFormData((prev) => ({ ...prev, paymentMethod: method.name }))}
                >
                  <span className="payment-icon">{method.icon}</span>
                  <span className="payment-name">{method.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="form-section">
            <h3>Receipt (Optional)</h3>
            <div className="file-upload-area">
              <input type="file" id="receipt" accept="image/*" onChange={handleFileChange} className="file-input" />
              <label htmlFor="receipt" className="file-upload-label">
                <div className="upload-icon">📷</div>
                <div className="upload-text">
                  {receiptFile ? (
                    <span className="file-selected">✅ {receiptFile.name}</span>
                  ) : (
                    <>
                      <span className="upload-primary">Click to upload receipt</span>
                      <span className="upload-secondary">PNG, JPG, GIF up to 10MB</span>
                    </>
                  )}
                </div>
              </label>
            </div>
          </div>

          <div className="form-section">
            <h3>Additional Details</h3>
            <div className="form-group">
              <label htmlFor="description">Description</label>
              <input
                type="text"
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Brief description"
              />
            </div>
            <div className="form-group">
              <label htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                placeholder="Any additional notes"
                rows="3"
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => navigate('/')} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Creating Expense...' : 'Create Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UploadReceipt;
