import React, { useState } from 'react';
import { localLogin, localRegister } from '../services/localAuth';

const LocalAuth = ({ onAuthenticated }) => {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = mode === 'login'
        ? await localLogin(email, password)
        : await localRegister(email, password, displayName);
      onAuthenticated({
        username: data.displayName || data.email,
        email: data.email,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-logo">
        <h1>ريـال</h1>
        <p className="tagline">مالك، في يدك</p>
        <p className="text-secondary" style={{ marginTop: 8, fontSize: '0.85rem' }}>
          Riyal · Saudi financial gamification
        </p>
      </div>

      <form className="glass-card auth-form" onSubmit={handleSubmit}>
        {error && <div className="error-banner">{error}</div>}

        {mode === 'register' && (
          <div className="form-field">
            <label>الاسم</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="اختياري"
            />
          </div>
        )}

        <div className="form-field">
          <label>البريد الإلكتروني</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="form-field">
          <label>كلمة المرور</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? '...' : mode === 'login' ? 'دخول' : 'إنشاء حساب'}
        </button>

        <button
          type="button"
          className="btn-ghost"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          {mode === 'login' ? 'حساب جديد' : 'عندك حساب؟ سجّل دخول'}
        </button>
      </form>
    </div>
  );
};

export default LocalAuth;
