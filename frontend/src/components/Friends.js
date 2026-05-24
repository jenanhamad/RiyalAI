import React, { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { api } from '../services/api';
import { formatXp, getMondayResetCountdown } from '../utils/format';

function parseInvite(raw) {
  const value = (raw || '').trim();
  if (!value) return '';
  try {
    if (value.includes('invite=')) {
      const url = value.startsWith('http') ? value : `https://local/?${value.replace(/^\?/, '')}`;
      return new URL(url).searchParams.get('invite') || '';
    }
    if (value.includes('://invite/')) {
      return value.split('/').pop().split('?')[0];
    }
  } catch {
    // plain username
  }
  return value.replace(/^@/, '');
}

const Friends = ({ user }) => {
  const [friends, setFriends] = useState([]);
  const [leaderboard, setLeaderboard] = useState(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [countdown, setCountdown] = useState(getMondayResetCountdown());
  const scannerRef = useRef(null);

  const inviteUrl = `${window.location.origin}/?invite=${encodeURIComponent(user?.username || '')}`;

  const load = useCallback(async () => {
    try {
      const [fRes, lbRes] = await Promise.all([
        api.getFriends(),
        api.getFriendsLeaderboard(),
      ]);
      setFriends(fRes.data.friends || []);
      setLeaderboard(lbRes.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => setCountdown(getMondayResetCountdown()), 60000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => () => {
    scannerRef.current?.clear().catch(() => {});
  }, []);

  const handleAdd = async (username) => {
    const name = parseInvite(username);
    if (!name) return;
    setError('');
    setSuccess('');
    try {
      await api.addFriend(name);
      setSuccess(`تمت إضافة ${name} ✓`);
      setUsernameInput('');
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    }
  };

  const handleRemove = async (friendId) => {
    try {
      await api.removeFriend(friendId);
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    }
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setSuccess('تم نسخ رابط الدعوة');
    } catch {
      setError('تعذر النسخ');
    }
  };

  const startScan = () => {
    setScanning(true);
    setError('');
    setTimeout(() => {
      const scanner = new Html5QrcodeScanner(
        'qr-reader',
        { fps: 10, qrbox: { width: 220, height: 220 } },
        false,
      );
      scannerRef.current = scanner;
      scanner.render(
        (decoded) => {
          scanner.clear().catch(() => {});
          scannerRef.current = null;
          setScanning(false);
          handleAdd(parseInvite(decoded));
        },
        () => {},
      );
    }, 100);
  };

  const stopScan = () => {
    scannerRef.current?.clear().catch(() => {});
    scannerRef.current = null;
    setScanning(false);
  };

  if (loading) {
    return (
      <div className="page loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  const rankings = leaderboard?.rankings || [];

  return (
    <div className="page friends-page">
      <h1 className="page-title">الأصدقاء</h1>
      <p className="page-subtitle text-secondary">أضف أصدقاء وتنافسوا أسبوعياً</p>

      {error && <div className="error-banner">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      <div className="glass-card friends-invite-card">
        <h2 className="friends-section-title">دعوتك</h2>
        <p className="text-secondary friends-invite-hint">شارك الباركود أو الرابط</p>
        <div className="friends-qr-wrap">
          <QRCodeSVG value={inviteUrl} size={160} level="M" includeMargin />
        </div>
        <p className="friends-username">@{user?.username}</p>
        <button type="button" className="btn-outline friends-copy-btn" onClick={copyInvite}>
          نسخ رابط ?invite={user?.username}
        </button>
      </div>

      <div className="glass-card friends-add-card">
        <h2 className="friends-section-title">إضافة صديق</h2>
        <form
          className="friends-add-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleAdd(usernameInput);
          }}
        >
          <input
            type="text"
            placeholder="اسم المستخدم"
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            autoComplete="off"
          />
          <button type="submit" className="btn-primary">إضافة</button>
        </form>
        {!scanning ? (
          <button type="button" className="btn-ghost friends-scan-btn" onClick={startScan}>
            📷 مسح باركود
          </button>
        ) : (
          <button type="button" className="btn-ghost friends-scan-btn" onClick={stopScan}>
            إيقاف المسح
          </button>
        )}
        {scanning && <div id="qr-reader" className="friends-qr-reader" />}
      </div>

      <h2 className="section-title">
        صدارة الأصدقاء
        <span className="text-secondary" style={{ fontSize: '0.75rem' }}>⏱ {countdown.label}</span>
      </h2>
      {rankings.map((entry) => (
        <div key={entry.userId} className={`leaderboard-row${entry.isMe ? ' is-me' : ''}`}>
          <span className="row-rank">#{entry.rank}</span>
          <span style={{ flex: 1 }}>{entry.isMe ? `أنت · ${entry.displayName}` : entry.displayName}</span>
          <span className={`font-mono${entry.isMe ? ' text-green' : ' text-secondary'}`}>
            {formatXp(entry.weeklyXp)} XP
          </span>
        </div>
      ))}

      <h2 className="section-title">قائمة الأصدقاء ({friends.length})</h2>
      {friends.length === 0 ? (
        <div className="empty-state">
          <p>ما عندك أصدقاء بعد</p>
          <p className="text-muted">شارك باركودك أو أضف username</p>
        </div>
      ) : (
        friends.map((f) => (
          <div key={f.userId} className="friends-row">
            <div>
              <div className="friends-row-name">{f.displayName}</div>
              <div className="text-secondary friends-row-meta">@{f.username} · Lv {f.level}</div>
            </div>
            <button type="button" className="btn-ghost friends-remove-btn" onClick={() => handleRemove(f.userId)}>
              حذف
            </button>
          </div>
        ))
      )}
    </div>
  );
};

export default Friends;
export { parseInvite };
