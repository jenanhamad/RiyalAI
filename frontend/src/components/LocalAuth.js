import React, { useState } from 'react';
import { localLogin, localRegister, forgotPassword } from '../services/localAuth';
import BrandLogo from './BrandLogo';

const LocalAuth = ({ onAuthenticated }) => {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accountMode, setAccountMode] = useState('personal');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      if (mode === 'forgot') {
        const msg = await forgotPassword(email);
        setSuccess(msg);
        return;
      }
      const data = mode === 'login'
        ? await localLogin(username, password)
        : await localRegister(username, password, email, accountMode);
      onAuthenticated({
        username: data.username || data.displayName,
        userId: data.userId,
        email: data.email,
        activeMode: data.activeMode || accountMode,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next) => {
    setMode(next);
    setError(null);
    setSuccess(null);
  };

  return (
    <div className="auth-screen">
      <div className="auth-logo">
        <BrandLogo />
        <p className="tagline">مالك، في يدك</p>
        <p className="text-secondary" style={{ marginTop: 8, fontSize: '0.85rem' }}>
          أفراد أو أعمال — نفس التطبيق
        </p>
      </div>

      <form className="glass-card auth-form" onSubmit={handleSubmit}>
        {error && <div className="error-banner">{error}</div>}
        {success && <div className="success-banner">{success}</div>}

        {mode === 'forgot' ? (
          <>
            <p className="text-secondary" style={{ fontSize: '0.85rem', marginBottom: 16 }}>
              أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور.
            </p>
            <div className="form-field">
              <label>البريد الإلكتروني</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="example@email.com"
              />
            </div>
          </>
        ) : (
          <>
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

        {mode === 'register' && (
          <>
            <div className="form-field">
              <label>البريد الإلكتروني</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="example@email.com"
              />
            </div>

            <div className="form-field">
              <label>نوع الحساب</label>
              <div className="mode-switcher auth-mode-pick" role="radiogroup" aria-label="نوع الحساب">
                <button
                  type="button"
                  role="radio"
                  aria-checked={accountMode === 'personal'}
                  className={`mode-switch-btn${accountMode === 'personal' ? ' active' : ''}`}
                  onClick={() => setAccountMode('personal')}
                >
                  أفراد
                  <span className="mode-pick-hint">XP وتحديات</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={accountMode === 'business'}
                  className={`mode-switch-btn${accountMode === 'business' ? ' active' : ''}`}
                  onClick={() => setAccountMode('business')}
                >
                  أعمال
                  <span className="mode-pick-hint">ربح وضريبة</span>
                </button>
              </div>
              <p className="text-secondary" style={{ fontSize: '0.75rem', marginTop: 8 }}>
                تقدر تبدّل بين الوضعين في أي وقت من التطبيق
              </p>
            </div>
          </>
        )}

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

        {mode === 'login' && (
          <button
            type="button"
            className="auth-forgot-link"
            onClick={() => switchMode('forgot')}
          >
            نسيت كلمة المرور؟
          </button>
        )}
          </>
        )}

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? '...' : mode === 'login' ? 'دخول' : mode === 'forgot' ? 'إرسال الرابط' : 'إنشاء حساب'}
        </button>

        {mode === 'forgot' ? (
          <button type="button" className="btn-ghost" onClick={() => switchMode('login')}>
            العودة لتسجيل الدخول
          </button>
        ) : (
        <button
          type="button"
          className="btn-ghost"
          onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
        >
          {mode === 'login' ? 'حساب جديد' : 'عندك حساب؟ سجّل دخول'}
        </button>
        )}
      </form>
    </div>
  );
};

export default LocalAuth;
