import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import ExpenseDetail from './components/ExpenseDetail';
import AddExpense from './components/AddExpense';
import Challenges from './components/Challenges';
import Leaderboard from './components/Leaderboard';
import Analytics from './components/Analytics';
import VoiceScreen from './components/VoiceScreen';
import LocalAuth from './components/LocalAuth';
import BottomNav from './components/layout/BottomNav';
import { getLocalUser, clearLocalSession } from './services/localAuth';
import { api, setUnauthorizedHandler } from './services/api';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setBooting(false);
    });

    async function bootstrap() {
      const local = getLocalUser();
      if (!local) {
        setBooting(false);
        return;
      }
      try {
        await api.getProfile();
        setUser(local);
      } catch {
        clearLocalSession();
        setUser(null);
      } finally {
        setBooting(false);
      }
    }

    bootstrap();
  }, []);

  if (booting) {
    return (
      <div className="page loading-screen">
        <div className="spinner" />
        <p>جاري التحميل...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <LocalAuth
        onAuthenticated={(u) => setUser(u)}
      />
    );
  }

  const handleSignOut = () => {
    clearLocalSession();
    setUser(null);
  };

  return (
    <Router>
      <div className="app-shell">
        <Routes>
          <Route path="/" element={<VoiceScreen user={user} />} />
          <Route path="/home" element={<Home user={user} onSignOut={handleSignOut} />} />
          <Route path="/challenges" element={<Challenges user={user} />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/add" element={<AddExpense />} />
          <Route path="/upload-receipt" element={<AddExpense />} />
          <Route path="/expense/:expenseId" element={<ExpenseDetail />} />
        </Routes>
        <BottomNav />
      </div>
    </Router>
  );
}

export default App;
