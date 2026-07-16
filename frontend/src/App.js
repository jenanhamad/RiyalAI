import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './components/Home';
import BusinessHome from './components/BusinessHome';
import ExpenseDetail from './components/ExpenseDetail';
import AddExpense from './components/AddExpense';
import Challenges from './components/Challenges';
import Leaderboard from './components/Leaderboard';
import Analytics from './components/Analytics';
import WeeklyStory from './components/WeeklyStory';
import BusinessGlance from './components/BusinessGlance';
import VoiceScreen from './components/VoiceScreen';
import LocalAuth from './components/LocalAuth';
import Friends, { parseInvite } from './components/Friends';
import BottomNav from './components/layout/BottomNav';
import { ModeProvider, useMode } from './context/ModeContext';
import { getLocalUser, clearLocalSession } from './services/localAuth';
import { api, setUnauthorizedHandler } from './services/api';
import './App.css';

function AppRoutes({ user, onSignOut, inviteNotice, setInviteNotice }) {
  const { isBusiness, syncMode } = useMode();

  useEffect(() => {
    api.getProfile()
      .then((res) => {
        if (res.data?.activeMode) syncMode(res.data.activeMode);
      })
      .catch(() => {});
  }, [syncMode]);

  return (
    <div className={`app-shell${isBusiness ? ' business-mode' : ''}`}>
      {inviteNotice && (
        <div className="invite-toast" onClick={() => setInviteNotice('')}>{inviteNotice}</div>
      )}
      <Routes>
        <Route path="/" element={<VoiceScreen user={user} />} />
        <Route
          path="/home"
          element={
            isBusiness
              ? <BusinessHome user={user} onSignOut={onSignOut} />
              : <Home user={user} onSignOut={onSignOut} />
          }
        />
        <Route
          path="/challenges"
          element={isBusiness ? <Navigate to="/home" replace /> : <Challenges user={user} />}
        />
        <Route
          path="/friends"
          element={isBusiness ? <Navigate to="/home" replace /> : <Friends user={user} />}
        />
        <Route
          path="/leaderboard"
          element={isBusiness ? <Navigate to="/home" replace /> : <Leaderboard />}
        />
        <Route
          path="/story"
          element={isBusiness ? <Navigate to="/glance" replace /> : <WeeklyStory />}
        />
        <Route
          path="/glance"
          element={isBusiness ? <BusinessGlance /> : <Navigate to="/story" replace />}
        />
        <Route
          path="/analytics"
          element={isBusiness ? <Navigate to="/glance" replace /> : <Analytics />}
        />
        <Route path="/add" element={<AddExpense />} />
        <Route path="/upload-receipt" element={<AddExpense />} />
        <Route path="/expense/:expenseId" element={<ExpenseDetail />} />
      </Routes>
      <BottomNav />
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [inviteNotice, setInviteNotice] = useState('');

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setBooting(false);
    });

    async function bootstrap() {
      const params = new URLSearchParams(window.location.search);
      const invite = parseInvite(params.get('invite') || sessionStorage.getItem('pendingInvite') || '');
      if (invite && params.get('invite')) {
        sessionStorage.setItem('pendingInvite', invite);
        window.history.replaceState({}, '', window.location.pathname);
      }

      const local = getLocalUser();
      if (!local) {
        setBooting(false);
        return;
      }
      try {
        const profile = await api.getProfile();
        setUser({
          ...local,
          activeMode: profile.data?.activeMode || local.activeMode || 'personal',
        });
        const pending = sessionStorage.getItem('pendingInvite');
        if (pending) {
          sessionStorage.removeItem('pendingInvite');
          try {
            const res = await api.addFriend(pending);
            setInviteNotice(`تمت إضافة ${res.data.friend?.displayName || pending} كصديق ✓`);
          } catch {
            setInviteNotice('');
          }
        }
      } catch {
        clearLocalSession();
        setUser(null);
      } finally {
        setBooting(false);
      }
    }

    bootstrap();
  }, []);

  const handleAuthenticated = async (u) => {
    setUser(u);
    const pending = sessionStorage.getItem('pendingInvite')
      || parseInvite(new URLSearchParams(window.location.search).get('invite') || '');
    if (pending) {
      sessionStorage.removeItem('pendingInvite');
      window.history.replaceState({}, '', window.location.pathname);
      try {
        const res = await api.addFriend(pending);
        setInviteNotice(`تمت إضافة ${res.data.friend?.displayName || pending} كصديق ✓`);
      } catch {
        // ignore duplicate / self
      }
    }
  };

  if (booting) {
    return (
      <div className="page loading-screen">
        <div className="spinner" />
        <p>جاري التحميل...</p>
      </div>
    );
  }

  if (!user) {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get('invite');
    if (invite) sessionStorage.setItem('pendingInvite', parseInvite(invite));

    return (
      <LocalAuth onAuthenticated={handleAuthenticated} />
    );
  }

  const handleSignOut = () => {
    clearLocalSession();
    setUser(null);
  };

  const initialMode = user.activeMode === 'business' ? 'business' : 'personal';

  return (
    <ModeProvider initialMode={initialMode}>
      <Router>
        <AppRoutes
          user={user}
          onSignOut={handleSignOut}
          inviteNotice={inviteNotice}
          setInviteNotice={setInviteNotice}
        />
      </Router>
    </ModeProvider>
  );
}

export default App;
