import React, { useState } from 'react';
import { localLogin, localRegister } from '../services/localAuth';

const LocalAuth = ({ onAuthenticated }) => {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = mode === 'login'
        ? await localLogin(username, password)
        : await localRegister(username, password);
      onAuthenticated({
        username: data.username || data.displayName,
        userId: data.userId,
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
        <h1>ريالي</h1>
        <p className="tagline">مالك، في يدك</p>
        <p className="text-secondary" style={{ marginTop: 8, fontSize: '0.85rem' }}>
          ryialAI
        </p>
      </div>

      <form className="glass-card auth-form" onSubmit={handleSubmit}>
        {error && <div className="error-banner">{error}</div>}

        <div className="form-field">
          <label>اسم المستخدم</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            maxLength={20}
            autoComplete="username"
            placeholder="مثال: jenan"
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
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
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
