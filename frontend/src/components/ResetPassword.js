import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../services/localAuth';

const ResetPassword = ({ onAuthenticated }) => {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await resetPassword(token, password);
      onAuthenticated({
        username: data.username || data.displayName,
        userId: data.userId,
        email: data.email,
        activeMode: data.activeMode || 'personal',
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="auth-screen">
        <div className="auth-logo">
          <h1>ريالي</h1>
          <p className="tagline">رابط غير صالح</p>
        </div>
        <div className="glass-card auth-form">
          <p className="text-secondary" style={{ textAlign: 'center', marginBottom: 16 }}>
            الرابط منتهي أو غير صحيح. اطلب رابطاً جديداً.
          </p>
          <Link to="/" className="btn-primary" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
            العودة لتسجيل الدخول
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <div className="auth-logo">
        <h1>ريالي</h1>
        <p className="tagline">كلمة مرور جديدة</p>
      </div>

      <form className="glass-card auth-form" onSubmit={handleSubmit}>
        {error && <div className="error-banner">{error}</div>}

        <div className="form-field">
          <label>كلمة المرور الجديدة</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>

        <div className="form-field">
          <label>تأكيد كلمة المرور</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? '...' : 'حفظ والدخول'}
        </button>

        <Link to="/" className="btn-ghost auth-text-link">
          العودة لتسجيل الدخول
        </Link>
      </form>
    </div>
  );
};

export default ResetPassword;
