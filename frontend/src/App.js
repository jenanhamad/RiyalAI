import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Authenticator } from '@aws-amplify/ui-react';
import { getCurrentUser, signOut } from 'aws-amplify/auth';
import '@aws-amplify/ui-react/styles.css';
import ExpensesList from './components/ExpensesList';
import ExpenseDetail from './components/ExpenseDetail';
import UploadReceipt from './components/UploadReceipt';
import MyRecurringExpenses from './components/MyRecurringExpenses';
import './aws-config';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);

  const financeQuotes = [
    'Every riyal tracked is a step toward financial clarity.',
    'Smart spending leads to financial freedom.',
    'Budget today for a better tomorrow.',
    'Small expenses add up to big insights.',
    'Knowledge of your spending is power over your finances.',
  ];

  const [currentQuote, setCurrentQuote] = useState(financeQuotes[0]);

  useEffect(() => {
    checkUser();

    const quoteInterval = setInterval(() => {
      setCurrentQuote(financeQuotes[Math.floor(Math.random() * financeQuotes.length)]);
    }, 5000);

    return () => clearInterval(quoteInterval);
  }, []);

  const checkUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch {
      setUser(null);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setUser(null);
      setShowAuth(false);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const AuthenticatedApp = () => (
    <Router>
      <div className="app">
        <nav className="navbar">
          <div className="nav-brand">
            <Link to="/" className="brand-link">
              <span className="brand-icon">💰</span>
              <span className="brand-text">RiyalAI</span>
            </Link>
          </div>

          <div className="nav-links">
            <Link to="/" className="nav-link">
              <span className="nav-icon">🏠</span>
              Dashboard
            </Link>
            <Link to="/upload-receipt" className="nav-link">
              <span className="nav-icon">📷</span>
              Add Expense
            </Link>
            <Link to="/my-recurring-expenses" className="nav-link">
              <span className="nav-icon">🔄</span>
              Recurring
            </Link>
          </div>

          <div className="nav-user">
            <span className="user-greeting">
              Hello, {user?.username || 'User'}!
            </span>
            <button onClick={handleSignOut} className="sign-out-btn">
              Sign Out
            </button>
          </div>
        </nav>

        <main className="main-content">
          <Routes>
            <Route path="/" element={<ExpensesList />} />
            <Route path="/expense/:expenseId" element={<ExpenseDetail />} />
            <Route path="/upload-receipt" element={<UploadReceipt />} />
            <Route path="/my-recurring-expenses" element={<MyRecurringExpenses />} />
          </Routes>
        </main>

        <footer className="footer">
          <div className="footer-content">
            <div className="quote-section">
              <p className="finance-quote">{currentQuote}</p>
            </div>
            <div className="footer-links">
              <span>© 2025 RiyalAI</span>
              <span>•</span>
              <span>Built with AWS & React</span>
            </div>
          </div>
        </footer>
      </div>
    </Router>
  );

  if (showAuth) {
    return (
      <div className="auth-container">
        <div className="auth-header">
          <h1>
            <span className="auth-icon">💰</span>
            RiyalAI
          </h1>
          <p>AI-powered expense tracking for smarter finances</p>
        </div>

        <Authenticator hideSignUp={false}>
          {({ user: authUser }) => {
            setUser(authUser);
            setShowAuth(false);
            return null;
          }}
        </Authenticator>

        <div className="auth-footer">
          <p className="finance-quote">{currentQuote}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="landing-container">
        <div className="landing-hero">
          <div className="hero-content">
            <h1 className="hero-title">
              <span className="hero-icon">💰</span>
              RiyalAI
            </h1>
            <p className="hero-subtitle">
              Smart expense tracking with AI-powered insights
            </p>
            <div className="hero-features">
              <div className="feature">
                <span className="feature-icon">📷</span>
                <span>Receipt Scanning</span>
              </div>
              <div className="feature">
                <span className="feature-icon">📊</span>
                <span>Smart Analytics</span>
              </div>
              <div className="feature">
                <span className="feature-icon">🔄</span>
                <span>Recurring Tracking</span>
              </div>
            </div>
            <button className="cta-button" onClick={() => setShowAuth(true)}>
              Get Started
            </button>
          </div>
        </div>

        <div className="landing-quote">
          <p className="finance-quote">{currentQuote}</p>
        </div>
      </div>
    );
  }

  return <AuthenticatedApp />;
}

export default App;
